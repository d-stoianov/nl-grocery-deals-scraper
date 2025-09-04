import * as puppeteer from 'puppeteer'
import { writeFile } from 'fs/promises'

const JUMBO_OFFERS_URL = 'https://www.jumbo.com/aanbiedingen/nu'
const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const OUTPUT_FILE_PATH = './out/jumbo.json'

const SELECTORS = {
    categorySection: '.category-section.padding-bottom',
    categoryTitle: '.category-heading strong',
    offerArticle: 'article',
    productName: '.content h3',
    dateString: '.content .subtitle',
    dealOneLine: '.tag span',
    dealTwoLinesUpper: '.tag .upper',
    dealTwoLinesLower: '.tag .lower',
    productImage: '.card-image img',
}

async function scrollToBottom(page) {
    let previousHeight = 0
    while (true) {
        const newHeight = await page.evaluate(() => document.body.scrollHeight)
        if (newHeight === previousHeight) {
            break // exit loop if the page height hasn't changed, meaning we're at the bottom.
        }
        previousHeight = newHeight
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
        // give the page a moment to load new content
    }
}

function extractRawDataFromPage(selectors) {
    const categoryElements = document.querySelectorAll(
        selectors.categorySection
    )
    const categoryData = []

    categoryElements.forEach((categoryElement) => {
        const categoryTitle = categoryElement
            .querySelector(selectors.categoryTitle)
            ?.innerText.trim()

        const offers = []
        const offerElements = categoryElement.querySelectorAll(
            selectors.offerArticle
        )

        offerElements.forEach((offerElement) => {
            // Extract all potential data points as raw text/attributes
            const productName = offerElement
                .querySelector(selectors.productName)
                ?.innerText.trim()
            const dateString = offerElement
                .querySelector(selectors.dateString)
                ?.textContent.trim()
            const dealOneLine = offerElement
                .querySelector(selectors.dealOneLine)
                ?.textContent.trim()
            const dealTwoLinesUpper = offerElement
                .querySelector(selectors.dealTwoLinesUpper)
                ?.textContent.trim()
            const dealTwoLinesLower = offerElement
                .querySelector(selectors.dealTwoLinesLower)
                ?.textContent.trim()
            const imageUrl = offerElement.querySelector(
                selectors.productImage
            )?.src

            offers.push({
                productName,
                imageUrl,
                rawDate: dateString,
                rawDeal: {
                    oneLine: dealOneLine,
                    twoLines: [dealTwoLinesUpper, dealTwoLinesLower],
                },
            })
        })

        if (categoryTitle && offers.length > 0) {
            categoryData.push({ categoryName: categoryTitle, offers })
        }
    })

    return categoryData
}

// parses a Dutch date string like "4 sep t/m 10 sep" into start and end UTC dates
function parseDateRange(dateStr) {
    if (!dateStr || !dateStr.includes(' t/m ')) return null

    const months = {
        jan: 0,
        feb: 1,
        mrt: 2,
        apr: 3,
        mei: 4,
        jun: 5,
        jul: 6,
        aug: 7,
        sep: 8,
        okt: 9,
        nov: 10,
        dec: 11,
    }
    const currentYear = new Date().getFullYear()

    const createUTCDate = (day, monthAbbr) => {
        const monthIndex = months[monthAbbr.toLowerCase()]
        if (day && monthIndex !== undefined) {
            return new Date(Date.UTC(currentYear, monthIndex, parseInt(day)))
        }
        return null
    }

    try {
        const [startPart, endPart] = dateStr
            .replace('wo ', '')
            .replace('di ', '')
            .split(' t/m ') // remove day names if present
        const [startDay, startMonthAbbr] = startPart.trim().split(' ')
        const [endDay, endMonthAbbr] = endPart.trim().split(' ')

        const startDate = createUTCDate(
            startDay,
            startMonthAbbr || endMonthAbbr
        )
        const endDate = createUTCDate(endDay, endMonthAbbr)

        if (!startDate || !endDate) return null

        // handle year transition e.g., "dec" to "jan"
        if (endDate < startDate) {
            endDate.setUTCFullYear(currentYear + 1)
        }

        return {
            start: startDate.toUTCString(),
            end: endDate.toUTCString(),
        }
    } catch (error) {
        console.error(`Failed to parse date string: "${dateStr}"`, error)
        return null
    }
}

// cleans and transforms the raw scraped data into its final structured format.
function processScrapedData(rawCategories) {
    return rawCategories.map((category) => ({
        ...category,
        offers: category.offers.map((offer) => {
            const dealText =
                offer.rawDeal.oneLine ||
                offer.rawDeal.twoLines.filter(Boolean).join(' ')

            return {
                productName: offer.productName,
                image: offer.imageUrl,
                deal: dealText,
                date: parseDateRange(offer.rawDate),
            }
        }),
    }))
}

async function scrapeOffers() {
    let browser
    try {
        console.log('Launching browser...')
        browser = await puppeteer.launch({ headless: true })
        const page = await browser.newPage()
        await page.setUserAgent(USER_AGENT)

        console.log(`Navigating to ${JUMBO_OFFERS_URL}...`)
        await page.goto(JUMBO_OFFERS_URL, { waitUntil: 'networkidle2' })
        await page.waitForSelector(SELECTORS.categorySection)

        console.log('Scrolling to load all offers...')
        await scrollToBottom(page)

        console.log('Extracting data from the page...')
        const rawData = await page.evaluate(extractRawDataFromPage, SELECTORS)

        console.log('Processing and cleaning data...')
        const cleanData = processScrapedData(rawData)

        return cleanData
    } catch (error) {
        console.error('An error occurred during scraping:', error)
        return []
    } finally {
        if (browser) {
            console.log('Closing browser.')
            await browser.close()
        }
    }
}

async function main() {
    console.log('Starting Jumbo offer scraper...')
    const offers = await scrapeOffers()

    if (offers.length > 0) {
        await writeFile(OUTPUT_FILE_PATH, JSON.stringify(offers, null, 4))
        console.log(
            `Successfully saved ${
                offers.flatMap((c) => c.offers).length
            } offers to ${OUTPUT_FILE_PATH}`
        )
    } else {
        console.log('No offers were scraped. Output file not written.')
    }
}

main()

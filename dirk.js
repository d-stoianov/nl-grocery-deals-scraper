import { JSDOM } from 'jsdom'
import { writeFile } from 'fs/promises'

const DIRK_OFFERS_URL = 'https://www.dirk.nl/aanbiedingen'
const OUTPUT_FILE_PATH = './out/dirk.json'

const SELECTORS = {
    dateString: '.date',
    categorySection: '.offers section',
    categoryTitle: 'h2',
    offerCard: 'article',
    productTitle: 'a.bottom .title',
    productImage: 'a img',
    priceNow: '.price-container .price',
    priceWas: '.regular-price span',
}

// mapping of Dutch month names to their numeric representation.
const months = {
    januari: 0,
    februari: 1,
    maart: 2,
    april: 3,
    mei: 4,
    juni: 5,
    juli: 6,
    augustus: 7,
    september: 8,
    oktober: 9,
    november: 10,
    december: 11,
}

// parses a Dutch date string like "4 september" into a UTC Date object
const parseDate = (dateStr) => {
    try {
        const [day, monthName] = dateStr.trim().toLowerCase().split(' ')
        const monthIndex = months[monthName]

        if (day && monthIndex !== undefined) {
            const year = new Date().getFullYear()
            return new Date(Date.UTC(year, monthIndex, parseInt(day)))
        }
        return null
    } catch (error) {
        console.error(`Failed to parse date: "${dateStr}"`, error)
        return null
    }
}

async function fetchAndParseHtml(url) {
    try {
        const response = await fetch(url)
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.statusText}`)
        }
        const html = await response.text()
        const dom = new JSDOM(html)
        return dom.window.document
    } catch (error) {
        console.error('Error fetching or parsing HTML:', error)
        return null
    }
}

// calculates the offer start and end date range.
// dirk's offers typically run for a week (e.g., Wednesday to Tuesday)
function calculateDateRange(endDateString) {
    if (!endDateString) return null

    const endDate = parseDate(endDateString)
    if (!endDate) return null

    // create start date by subtracting 6 days from the end date for a 7-day offer period
    // using setDate correctly handles month/year rollovers
    const startDate = new Date(endDate)
    startDate.setDate(endDate.getDate() - 6)

    return {
        from: startDate.toISOString(),
        to: endDate.toISOString(),
    }
}

function extractOffers(document) {
    const allCategories = []

    const endDateString = document.querySelector(
        SELECTORS.dateString
    )?.textContent
    const dateRange = calculateDateRange(endDateString)

    if (!dateRange) {
        console.warn(
            'Could not determine offer date range. Dates will be null.'
        )
    }

    const categoryElements = document.querySelectorAll(
        SELECTORS.categorySection
    )

    categoryElements.forEach((categoryElement) => {
        const categoryName = categoryElement
            .querySelector(SELECTORS.categoryTitle)
            ?.textContent.trim()

        const offerCards = categoryElement.querySelectorAll(SELECTORS.offerCard)
        const offers = []

        offerCards.forEach((card) => {
            const productName = card
                .querySelector(SELECTORS.productTitle)
                ?.textContent.trim()
            const imageUrl = card.querySelector(SELECTORS.productImage)?.src
            const priceNow = card
                .querySelector(SELECTORS.priceNow)
                ?.textContent.trim()
            const priceWas = card
                .querySelector(SELECTORS.priceWas)
                ?.textContent.trim()

            if (productName) {
                offers.push({
                    productName,
                    image: imageUrl || null,
                    price: {
                        now: priceNow || null,
                        was: priceWas || null,
                    },
                    date: dateRange,
                })
            }
        })

        if (categoryName && offers.length > 0) {
            allCategories.push({
                categoryName,
                offers,
            })
        }
    })

    return allCategories
}

async function scrapeDirkOffers() {
    console.log(`Navigating to ${DIRK_OFFERS_URL}...`)
    const document = await fetchAndParseHtml(DIRK_OFFERS_URL)

    if (!document) {
        console.error('Could not get the document, aborting scrape.')
        return []
    }

    console.log('Extracting offer data from the page...')
    const offers = extractOffers(document)
    return offers
}

async function main() {
    console.log('Starting Dirk offer scraper...')
    const categories = await scrapeDirkOffers()

    if (categories.length > 0) {
        const offerCount = categories.reduce(
            (sum, cat) => sum + cat.offers.length,
            0
        )
        await writeFile(OUTPUT_FILE_PATH, JSON.stringify(categories, null, 4))
        console.log(
            `✅ Successfully saved ${offerCount} offers from ${categories.length} categories to ${OUTPUT_FILE_PATH}`
        )
    } else {
        console.log('No offers were scraped. Output file not written.')
    }
}

main()

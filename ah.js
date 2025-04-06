import * as puppeteer from 'puppeteer'

async function scrapeOffers() {
    const browser = await puppeteer.launch({ headless: true })
    const page = await browser.newPage()

    await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )

    await page.goto('https://www.ah.nl/bonus', {
        waitUntil: 'networkidle2',
    })

    await page.waitForSelector('.grid_spanFrom-lg-2__jv8EM')

    let previousHeight = 0
    while (true) {
        let newHeight = await page.evaluate(() => document.body.scrollHeight)
        if (newHeight === previousHeight) break
        previousHeight = newHeight
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
    }

    const categories = await page.evaluate(() => {
        // date parsing code

        const months = {
            januari: 1,
            februari: 2,
            maart: 3,
            april: 4,
            mei: 5,
            juni: 6,
            juli: 7,
            augustus: 8,
            september: 9,
            oktober: 10,
            november: 11,
            december: 12,
        }

        const parseDate = (dateStr, year) => {
            const [day, monthAbbr] = dateStr.split(' ')
            const month = months[monthAbbr.toLowerCase()]
            if (!month) throw new Error(`Invalid month: ${monthAbbr}`)

            return new Date(Date.UTC(year, month - 1, parseInt(day)))
        }

        const processDateString = (dateString) => {
            const parts = dateString.split(' t/m ')
            if (parts.length !== 2) throw new Error('Invalid date range format')

            const [startDay, startMonth] = parts[0].trim().split(' ')
            const [endDay, endMonth] = parts[1].trim().split(' ')

            const year = new Date().getFullYear()

            const startDate = parseDate(
                `${startDay} ${startMonth || endMonth}`,
                year
            )
            const endDate = parseDate(
                `${endDay} ${endMonth || startMonth}`,
                year
            )

            return {
                start: startDate.toUTCString(),
                end: endDate.toUTCString(),
            }
        }

        // end date parsing code

        const categoryElements = document.querySelectorAll(
            '.grid_spanFrom-lg-2__jv8EM section'
        )
        const categoryData = []

        const startAndEndDateString = document
            ?.querySelector('.period-toggle_periodLabel__NVVAd')
            ?.textContent.trim()

        categoryElements.forEach((categoryElement) => {
            const categoryTitle = categoryElement
                .querySelector('div h3')
                ?.innerText.trim()

            const offers = []
            const offerElements = categoryElement.querySelectorAll(
                `[data-testhook="card"]`
            )

            offerElements.forEach((offerElement) => {
                const contentContainer = offerElement.querySelector(
                    `[data-testhook="card-content"]`
                )

                const productName = contentContainer
                    .querySelector(`[data-testhook="card-title"] span`)
                    ?.innerText.trim()

                const dealsText = [
                    ...offerElement.querySelectorAll(
                        `[data-testhook="promotion-text"]`
                    ),
                ]
                    .map((span) => span.innerText.trim())
                    .join(' ')

                const price = offerElement.querySelector(
                    `[data-testhook="price"]`
                )

                // bc of the lazy loading no image in src initially
                const imageUrl = offerElement
                    .querySelector('[data-testid="card-image"] img')
                    ?.getAttribute('data-src')

                offers.push({
                    productName,
                    image: imageUrl,
                    deal: dealsText,
                    date: processDateString(startAndEndDateString),
                    price: {
                        now: price?.getAttribute('data-testpricenow'),
                        was: price?.getAttribute('data-testpricewas'),
                    },
                })
            })

            categoryData.push({ categoryName: categoryTitle, offers })
        })

        return categoryData
    })

    await browser.close()
    return categories
}

async function main() {
    const offers = await scrapeOffers()
    console.log(JSON.stringify(offers, null, 2))
    return offers
}

main()

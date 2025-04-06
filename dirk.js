import { JSDOM } from 'jsdom'

import { parseDate } from './utils/date.js'

const URL = 'https://www.dirk.nl/aanbiedingen'

async function scrapeOffers() {
    const response = await fetch(URL)
    const html = await response.text()

    const dom = new JSDOM(html)
    const document = dom.window.document

    const endDateString = document.querySelector('.date')?.textContent

    const result = []

    const categories = [...document.querySelectorAll('.offers section')]

    categories.forEach((category) => {
        const categoryName = category.querySelector('h2').textContent

        const offers = []

        const cards = [...category.querySelectorAll('article')]

        cards.forEach((card) => {
            const productName =
                card.querySelector('a.bottom .title').textContent
            const imageUrl = card.querySelector('a img')?.src

            const price = {
                now: card.querySelector('.price-container .price')?.textContent,
                was: card.querySelector('.regular-price span')?.textContent,
            }

            const endDate = parseDate(endDateString)
            const startDate = new Date(
                endDate.getFullYear(),
                endDate.getMonth(),
                endDate.getDate() - 5,
                0,
                0,
                0
            )
            const date = {
                from: startDate,
                to: endDate,
            }

            offers.push({
                productName,
                image: imageUrl,
                price,
                date: date,
            })

            result.push({
                categoryName,
                offers,
            })
        })
    })

    return result
}

async function main() {
    const offers = await scrapeOffers()
    console.log(JSON.stringify(offers, null, 4))
    return offers
}

main()

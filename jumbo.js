import * as puppeteer from "puppeteer"

async function scrapeOffers() {
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  )

  await page.goto("https://www.jumbo.com/aanbiedingen/nu", {
    waitUntil: "networkidle2",
  })

  await page.waitForSelector(".category-section.padding-bottom")

  let previousHeight = 0
  while (true) {
    let newHeight = await page.evaluate(() => document.body.scrollHeight)
    if (newHeight === previousHeight) break
    previousHeight = newHeight
    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
  }

  const categories = await page.evaluate(() => {
    // date parsing code
    const parseDate = (dateStr, year) => {
      const months = {
        jan: 1,
        feb: 2,
        mrt: 3,
        apr: 4,
        mei: 5,
        jun: 6,
        jul: 7,
        aug: 8,
        sep: 9,
        okt: 10,
        nov: 11,
        dec: 12,
      }

      // Split the date string into day and month
      const [day, monthAbbr] = dateStr.split(" ")
      const month = months[monthAbbr.toLowerCase()]

      // Create the Date object in GMT (UTC)
      return new Date(Date.UTC(year, month - 1, parseInt(day)))
    }

    const processDateString = (dateString) => {
      const parts = dateString.split(" t/m ")
      const startPart = parts[0].trim()
      const endPart = parts[1].trim()

      const startParts = startPart.split(" ")
      const endParts = endPart.split(" ")

      const startDay = startParts[1]
      const endDay = endParts[1]

      const startMonth = startParts[2] || endParts[2]
      const endMonth = endParts[2] || startParts[2]

      const year = new Date().getFullYear()

      const startDate = parseDate(`${startDay} ${startMonth}`, year)
      const endDate = parseDate(`${endDay} ${endMonth}`, year)

      return {
        start: startDate.toUTCString(),
        end: endDate.toUTCString(),
      }
    }

    // end date parsing code

    const categoryElements = document.querySelectorAll(
      ".category-section.padding-bottom"
    )
    const categoryData = []

    categoryElements.forEach((categoryElement) => {
      const categoryTitle = categoryElement
        .querySelector(".category-heading strong")
        ?.innerText.trim()

      const offers = []
      const offerElements = categoryElement.querySelectorAll("article")

      offerElements.forEach((offerElement) => {
        const productName = offerElement
          .querySelector(".content h3")
          ?.innerText.trim()

        const startAndEndDateString = offerElement
          ?.querySelector(".content .subtitle")
          ?.textContent.trim()

        const startAndEndDate = processDateString(startAndEndDateString)

        const onelineDeal = offerElement
          .querySelector(".tag span")
          ?.textContent.trim()
        const twoLinesdeal = {
          upper: offerElement.querySelector(".tag .upper")?.textContent.trim(),
          lower: offerElement.querySelector(".tag .lower")?.textContent.trim(),
        }

        const imageUrl = offerElement.querySelector(".card-image img")?.src

        offers.push({
          productName,
          image: imageUrl,
          deal: onelineDeal ?? twoLinesdeal,
          date: startAndEndDate,
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
}

main()

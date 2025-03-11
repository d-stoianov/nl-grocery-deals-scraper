const puppeteer = require("puppeteer")

async function scrapeJumboOffers() {
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  )

  await page.goto("https://www.jumbo.com/aanbiedingen/nu", {
    waitUntil: "networkidle2",
  })

  let previousHeight = 0
  while (true) {
    let newHeight = await page.evaluate(() => document.body.scrollHeight)
    if (newHeight === previousHeight) break
    previousHeight = newHeight
    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  const categories = await page.evaluate(() => {
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
        const content = offerElement
          .querySelector(".content h3")
          ?.innerText.trim()

        const onelineDeal = offerElement.querySelector(".tag span")?.textContent
        const twoLinesdeal = {
          upper: offerElement.querySelector(".tag .upper")?.textContent,
          lower: offerElement.querySelector(".tag .lower")?.textContent,
        }

        const imageUrl = offerElement.querySelector(".card-image img")?.src

        offers.push({
          image: imageUrl,
          content,
          deal: onelineDeal ?? twoLinesdeal,
        })
      })

      categoryData.push({ name: categoryTitle, offers })
    })

    return categoryData
  })

  await browser.close()
  return categories
}

async function main() {
  const jumboOffers = await scrapeJumboOffers()
  console.log(JSON.stringify(jumboOffers, null, 2))
}

main()

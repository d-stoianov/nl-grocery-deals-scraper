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

const currentYear = new Date().getFullYear()

const parseDate = (dateStr, year = currentYear) => {
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

    const startDate = parseDate(`${startDay} ${startMonth || endMonth}`, year)
    const endDate = parseDate(`${endDay} ${endMonth || startMonth}`, year)

    return {
        start: startDate.toUTCString(),
        end: endDate.toUTCString(),
    }
}

export { parseDate, processDateString }

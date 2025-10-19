export function parseHDFCStatement(body: string) {
  const transactions = []
  const lines = body.split('\n')

  for (const line of lines) {
    const match = line.match(/(\d{2}-\w{3}-\d{4})\s+(.*?)\s+([\d,]+\.\d{2})\s+(Cr|Dr)/)

    if (match) {
      transactions.push({
        date: match[1],
        description: match[2].trim(),
        amount: parseFloat(match[3].replace(/,/g, '')),
        type: match[4],
      })
    }
  }

  return transactions
}
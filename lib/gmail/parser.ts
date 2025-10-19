import { parseHDFCStatement } from './patterns'

export function parseEmail(body: string) {
  // Add more parsers here as needed
  return parseHDFCStatement(body)
}
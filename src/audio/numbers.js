const small = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const tens = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];
export function numberText(number) {
  if (!Number.isSafeInteger(number) || number < 0)
    throw new Error("Invalid number");
  if (number < 20) return small[number];
  if (number < 100)
    return (
      tens[Math.floor(number / 10)] +
      (number % 10 ? "-" + small[number % 10].toLowerCase() : "")
    );
  if (number === 100) return "One hundred";
  // Speech synthesis reads the numeric text for numbers outside the file library.
  return String(number);
}
export function audioPath(number) {
  return `/audio/sonia/${String(number).padStart(3, "0")}.mp3`;
}

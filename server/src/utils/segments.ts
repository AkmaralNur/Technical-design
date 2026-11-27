/** true, если участки [aFrom, aTo) и [bFrom, bTo) пересекаются (раздел 11.3) */
export function segmentsOverlap(aFrom: number, aTo: number, bFrom: number, bTo: number): boolean {
  return aFrom < bTo && bFrom < aTo;
}

/** Создаёт список мест вагона по схеме ряда: 'AB_CD' → 1A,1B,1C,1D,2A… (раздел 10.10) */
export function buildSeats(trainId: bigint | number, carriageNo: number, rowsCount: number, layout: string) {
  const letters = layout.split('').filter((ch) => ch !== '_');
  const seats: { trainId: bigint; carriageNo: number; rowNo: number; seatLetter: string; seatLabel: string }[] = [];
  for (let row = 1; row <= rowsCount; row++) {
    for (const letter of letters) {
      seats.push({ trainId: BigInt(trainId), carriageNo, rowNo: row, seatLetter: letter, seatLabel: `${row}${letter}` });
    }
  }
  return seats;
}

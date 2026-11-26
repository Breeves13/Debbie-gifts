import { christmasReport } from './reports'
import { money, type Data } from './types'

export async function exportChristmasPdf(data: Data) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const report = christmasReport(data.recipients, data.gifts)
  const doc = new jsPDF()
  doc.setFontSize(22)
  doc.text("Debbie's Gifts", 14, 18)
  doc.setFontSize(12)
  doc.text('Christmas Gift List', 14, 26)
  autoTable(doc, {
    startY: 34,
    head: [['Item', 'Storage Location', 'Price']],
    body: report.groups.flatMap(group => [
      [{ content: group.name, colSpan: 3, styles: { fontStyle: 'bold' as const, fillColor: '#f4e9e5' } }],
      ...group.gifts.map(gift => [gift.item, gift.storage_location || '—', money(gift.price)]),
      [{ content: 'Subtotal', colSpan: 2 }, money(group.subtotal)],
    ]),
    foot: [['Grand Total', '', money(report.total)]],
    showFoot: 'lastPage',
    rowPageBreak: 'avoid',
    headStyles: { fillColor: '#783a42' },
    footStyles: { fillColor: '#783a42' },
    columnStyles: { 2: { halign: 'right' } },
  })
  doc.save('debbies-christmas-gifts.pdf')
}

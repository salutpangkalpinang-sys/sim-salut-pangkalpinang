const { mdToPdf } = require('md-to-pdf');
const fs = require('fs');
const path = require('path');

const mdPath = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\76926e86-1a4d-4849-bf85-0885d3a5e37b\\uat_roadmap_detail.md';
const pdfPath = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\76926e86-1a4d-4849-bf85-0885d3a5e37b\\Peta_Panduan_Pengujian_UAT_SIM_SALUT_A4_Detail.pdf';

async function convert() {
  console.log('Converting Markdown to PDF A4...');
  const pdf = await mdToPdf({ path: mdPath });
  if (pdf && pdf.content) {
    fs.writeFileSync(pdfPath, pdf.content);
    console.log('PDF Generated Successfully at:', pdfPath);
  } else {
    console.error('PDF generation returned empty content');
  }
}

convert().catch(err => {
  console.error('Error generating PDF:', err);
  process.exit(1);
});

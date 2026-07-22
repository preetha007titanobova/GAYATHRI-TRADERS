const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

// Simple Markdown to HTML parser
function parseMarkdown(md) {
    let html = md;

    // Escaping HTML characters
    html = html
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Handle code blocks (temporary replacement to avoid double parsing)
    const codeBlocks = [];
    html = html.replace(/```([\s\S]*?)```/g, (match, p1) => {
        codeBlocks.push(p1);
        return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });

    // Handle inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Handle headers
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');

    // Handle bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Handle tables (very simple parser)
    html = html.replace(/^\| (.*) \|$/gim, (match, content) => {
        const cells = content.split(' | ').map(c => `<td>${c.trim()}</td>`).join('');
        return `<tr>${cells}</tr>`;
    });
    // Wrap consecutive trs in tables
    html = html.replace(/(<tr>.*<\/tr>)+/g, '<table>$0</table>');
    // Simple fix for headers in tables
    html = html.replace(/<table>\s*<tr>\s*<td>(.*?):---(.*?)\s*<\/td>.*?<\/tr>/g, '<table>');
    // Replace first row inside table to th if it is a header row
    html = html.replace(/<table>\s*<tr>([\s\S]*?)<\/tr>/g, (match, p1) => {
        const ths = p1.replace(/<td>/g, '<th>').replace(/<\/td>/g, '<\/th>');
        return `<table><thead><tr>${ths}</tr></thead><tbody>`;
    });
    html = html.replace(/<\/table>/g, '</tbody></table>');

    // Handle lists
    // Unordered lists
    html = html.replace(/^\s*-\s*\[([ xX/])\]\s*(.*)$/gim, (match, checked, item) => {
        const isChecked = checked.toLowerCase() === 'x' ? 'checked' : '';
        return `<li><input type="checkbox" ${isChecked} disabled /> ${item}</li>`;
    });
    html = html.replace(/^\s*[-*]\s*(.*)$/gim, '<li>$1</li>');
    // Wrap list items in ul
    html = html.replace(/(<li>.*<\/li>)+/g, '<ul>$0</ul>');

    // Handle links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Handle line breaks / paragraphs
    html = html.replace(/^\s*$/gim, '<p></p>');

    // Restore code blocks with formatting
    codeBlocks.forEach((code, index) => {
        html = html.replace(`__CODE_BLOCK_${index}__`, `<pre><code>${code.trim()}</code></pre>`);
    });

    return html;
}

async function generatePDF() {
    const archPath = path.join('C:', 'Users', 'Preetha T', '.gemini', 'antigravity-ide', 'brain', '037a87fa-46a9-422e-9354-dc08c9d39f6a', 'licensing_system_architecture.md');
    const walkPath = path.join('C:', 'Users', 'Preetha T', '.gemini', 'antigravity-ide', 'brain', '037a87fa-46a9-422e-9354-dc08c9d39f6a', 'walkthrough.md');
    const outputPath = path.join('D:', 'Namma Kada', 'ITHU-NAMMA-KADA', 'Ithu_Namma_Kada_Licensing_Architecture.pdf');
    const artifactPdfPath = path.join('C:', 'Users', 'Preetha T', '.gemini', 'antigravity-ide', 'brain', '037a87fa-46a9-422e-9354-dc08c9d39f6a', 'Ithu_Namma_Kada_Licensing_Architecture.pdf');

    if (!fs.existsSync(archPath)) {
        console.error('Source architecture markdown not found.');
        return;
    }

    console.log('Reading markdown files...');
    const archMd = fs.readFileSync(archPath, 'utf8');
    const walkMd = fs.existsSync(walkPath) ? fs.readFileSync(walkPath, 'utf8') : '';

    console.log('Parsing markdown content...');
    const archHtml = parseMarkdown(archMd);
    const walkHtml = parseMarkdown(walkMd);

    const fullHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8" />
        <title>ITHU NAMMA KADA - Licensing Guide</title>
        <style>
            body {
                font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                color: #1e293b;
                line-height: 1.6;
                padding: 40px;
                background-color: #ffffff;
                font-size: 14px;
            }
            h1, h2, h3, h4 {
                font-family: 'Outfit', sans-serif;
                color: #0f172a;
                margin-top: 24px;
                margin-bottom: 12px;
                page-break-after: avoid;
            }
            h1 {
                font-size: 28px;
                border-bottom: 2px solid #e2e8f0;
                padding-bottom: 8px;
                margin-top: 40px;
            }
            h2 {
                font-size: 20px;
                border-bottom: 1px solid #e2e8f0;
                padding-bottom: 6px;
                color: #1e1b4b;
            }
            h3 {
                font-size: 16px;
                color: #4f46e5;
            }
            p {
                margin-bottom: 16px;
            }
            code {
                font-family: Consolas, Monaco, 'Andale Mono', monospace;
                background-color: #f1f5f9;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 13px;
                color: #0f172a;
            }
            pre {
                background-color: #0f172a;
                color: #f8fafc;
                padding: 16px;
                border-radius: 8px;
                overflow-x: auto;
                margin-bottom: 20px;
                page-break-inside: avoid;
            }
            pre code {
                background-color: transparent;
                padding: 0;
                color: #e2e8f0;
                font-size: 12px;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 24px;
                page-break-inside: avoid;
            }
            th, td {
                border: 1px solid #cbd5e1;
                padding: 10px 12px;
                text-align: left;
            }
            th {
                background-color: #f8fafc;
                font-weight: 600;
                color: #0f172a;
            }
            ul {
                margin-bottom: 16px;
                padding-left: 20px;
            }
            li {
                margin-bottom: 6px;
            }
            .page-break {
                page-break-before: always;
            }
            .header-banner {
                background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
                color: white;
                padding: 40px;
                border-radius: 12px;
                margin-bottom: 40px;
                text-align: center;
            }
            .header-banner h1 {
                color: white;
                border: none;
                margin: 0;
                font-size: 32px;
            }
            .header-banner p {
                color: #c7d2fe;
                font-size: 16px;
                margin-top: 10px;
                margin-bottom: 0;
            }
        </style>
    </head>
    <body>
        <div class="header-banner">
            <h1>ITHU NAMMA KADA</h1>
            <p>Cryptographic Licensing & Offline Activation Manual</p>
        </div>
        
        ${archHtml}
        
        <div class="page-break"></div>
        
        <h1>Walkthrough & Verification Results</h1>
        ${walkHtml}
    </body>
    </html>
    `;

    console.log('Launching browser via Puppeteer...');
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    console.log('Loading HTML content into Puppeteer...');
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

    console.log('Printing to PDF...');
    await page.pdf({
        path: outputPath,
        format: 'A4',
        margin: {
            top: '20mm',
            bottom: '20mm',
            left: '20mm',
            right: '20mm'
        },
        printBackground: true
    });

    // Also copy to artifact directory
    fs.copyFileSync(outputPath, artifactPdfPath);

    await browser.close();
    console.log(`PDF successfully generated:`);
    console.log(`Workspace Path: ${outputPath}`);
    console.log(`Artifact Path: ${artifactPdfPath}`);
}

generatePDF();

import nodemailer from 'nodemailer';

export const sendCloseDayEmail = async (dateStr: string, base64Pdf: string, ownerEmail: string): Promise<boolean> => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // Strip potential data URL scheme
  const base64Data = base64Pdf.replace(/^data:application\/pdf;base64,/, '');

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: ownerEmail || 'titanobovapvt@gmail.com',
    subject: `Sri Gayathri Traders - Daily Stock Status Report (${dateStr})`,
    text: `Hello,\n\nPlease find attached the Daily Stock Status Report for ${dateStr}.\n\nBest Regards,\nSri Gayathri Traders Billing System`,
    attachments: [
      {
        filename: `Daily_Stock_Status_${dateStr}.pdf`,
        content: base64Data,
        encoding: 'base64'
      }
    ]
  };

  await transporter.sendMail(mailOptions);
  return true;
};

export const uploadPdfToTmpFiles = async (base64Pdf: string, filename: string): Promise<string | null> => {
  try {
    const base64Data = base64Pdf.replace(/^data:application\/pdf;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    const formData = new FormData();
    const fileBlob = new Blob([buffer], { type: 'application/pdf' });
    formData.append('file', fileBlob, filename);
    
    const response = await fetch('https://tmpfiles.org/api/v1/upload', {
      method: 'POST',
      body: formData
    });
    
    if (response.ok) {
      const resJson = await response.json() as any;
      let url = resJson?.data?.url;
      if (url) {
        url = url.replace('https://tmpfiles.org/', 'https://tmpfiles.org/dl/');
      }
      return url;
    } else {
      console.error("tmpfiles.org upload failed:", response.status, await response.text());
    }
  } catch (error) {
    console.error("Failed to upload PDF:", error);
  }
  return null;
};


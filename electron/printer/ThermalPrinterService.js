const net = require('net');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const EscPosBuilder = require('./EscPosBuilder');

class ThermalPrinterService {
  constructor() {
    this.isProcessing = false;
    this.queue = [];
  }

  async print(payload, config) {
    return new Promise((resolve, reject) => {
      this.queue.push({ payload, config, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    const task = this.queue.shift();

    if (!task) {
      this.isProcessing = false;
      return;
    }

    try {
      const { payload, config, resolve, reject } = task;
      const builder = new EscPosBuilder({
        paperWidth: config.paperWidth || '80mm',
        openCashDrawer: config.openCashDrawer,
        autoCut: config.autoCut !== false
      });

      if (config.openCashDrawer) {
        builder.openCashDrawer();
      }

      const buffer = builder.printReceipt(payload);

      if (config.communicationType === 'network-socket' && config.networkIp) {
        await this.sendToNetworkPrinter(buffer, config.networkIp, config.networkPort || 9100);
        resolve({ success: true, message: `Sent to network printer ${config.networkIp}` });
      } else {
        await this.sendToLocalPrinterSpooler(buffer, config.printerName || 'POS-80');
        resolve({ success: true, message: `Sent raw ESC/POS payload to printer spooler ${config.printerName}` });
      }
    } catch (err) {
      console.error('[ThermalPrinterService] Print Error:', err);
      task.reject({ success: false, error: err ? err.message : String(err) });
    } finally {
      this.isProcessing = false;
      this.processQueue();
    }
  }

  sendToNetworkPrinter(buffer, ip, port) {
    return new Promise((resolve, reject) => {
      const client = new net.Socket();
      client.setTimeout(5000);

      client.connect(port, ip, () => {
        client.write(buffer, () => {
          client.end();
          resolve();
        });
      });

      client.on('error', (err) => {
        client.destroy();
        reject(err);
      });

      client.on('timeout', () => {
        client.destroy();
        reject(new Error(`Connection to printer ${ip}:${port} timed out.`));
      });
    });
  }

  sendToLocalPrinterSpooler(buffer, printerName) {
    return new Promise((resolve, reject) => {
      if (!printerName) {
        return reject(new Error('Printer name is required for raw TSPL printing.'));
      }
      if (process.platform === 'win32') {
        const tempFilePath = path.join(process.env.TEMP || 'C:\\Windows\\Temp', `rawprint_${Date.now()}.bin`);
        fs.writeFileSync(tempFilePath, buffer);

        const escapePath = tempFilePath.replace(/\\/g, '\\\\');
        const escapePrinter = printerName.replace(/"/g, '""');

        const psScript = `
$code = @"
using System;
using System.IO;
using System.Runtime.InteropServices;
public class RawPrintHelper {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }
    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    public static bool SendFile(string printerName, string filePath) {
        byte[] bytes = File.ReadAllBytes(filePath);
        IntPtr hPrinter = IntPtr.Zero;
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "RAW Thermal TSPL Job";
        di.pDataType = "RAW";
        if (OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {
            if (StartDocPrinter(hPrinter, 1, di)) {
                if (StartPagePrinter(hPrinter)) {
                    IntPtr pBytes = Marshal.AllocCoTaskMem(bytes.Length);
                    Marshal.Copy(bytes, 0, pBytes, bytes.Length);
                    Int32 dwWritten;
                    WritePrinter(hPrinter, pBytes, bytes.Length, out dwWritten);
                    Marshal.FreeCoTaskMem(pBytes);
                    EndPagePrinter(hPrinter);
                }
                EndDocPrinter(hPrinter);
            }
            ClosePrinter(hPrinter);
            return true;
        }
        return false;
    }
}
"@
if (-not ([System.Management.Automation.PSTypeName]'RawPrintHelper').Type) {
    Add-Type -TypeDefinition $code
}
[RawPrintHelper]::SendFile("${escapePrinter}", "${escapePath}")
`;

        const psTempScript = path.join(process.env.TEMP || 'C:\\Windows\\Temp', `printscript_${Date.now()}.ps1`);
        fs.writeFileSync(psTempScript, psScript, 'utf8');

        exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psTempScript}"`, (error, stdout, stderr) => {
          try {
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            if (fs.existsSync(psTempScript)) fs.unlinkSync(psTempScript);
          } catch (e) {}

          if (error) {
            console.error('[ThermalPrinterService] Powershell Raw Spool error:', error, stderr);
            reject(new Error(`Raw printer spooling error: ${stderr || error.message}`));
          } else {
            resolve();
          }
        });
      } else {
        const tempFilePath = path.join('/tmp', `rawprint_${Date.now()}.bin`);
        fs.writeFileSync(tempFilePath, buffer);
        exec(`lp -d "${printerName}" -o raw "${tempFilePath}"`, (error) => {
          try {
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
          } catch (e) {}
          if (error) reject(error);
          else resolve();
        });
      }
    });
  }
}

module.exports = ThermalPrinterService;

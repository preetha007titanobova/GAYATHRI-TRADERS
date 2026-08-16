import { exec, execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

let activePrinterName = '';

export interface InstalledPrinter {
  name: string;
  isDefault: boolean;
  status?: string;
}

export const getInstalledPrinters = (): Promise<InstalledPrinter[]> => {
  return new Promise((resolve) => {
    if (os.platform() !== 'win32') {
      return resolve([{ name: 'TSC TE244 Barcode Printer', isDefault: true }]);
    }

    const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Printer | Select-Object Name, Default | ConvertTo-Json"`;
    exec(command, { timeout: 2000 }, (err, stdout) => {
      if (err || !stdout) {
        return resolve([{ name: activePrinterName || 'TSC TE244 Barcode Printer', isDefault: true }]);
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        const list = Array.isArray(parsed) ? parsed : [parsed];
        const printers: InstalledPrinter[] = list.map((p: any) => ({
          name: p.Name || p.name,
          isDefault: !!(p.Default || p.isDefault)
        }));

        if (!activePrinterName && printers.length > 0) {
          const thermal = printers.find(p => {
            const n = p.name.toUpperCase();
            return n.includes('TSC') || n.includes('TE244') || n.includes('BARCODE') || n.includes('LABEL') || n.includes('POS') || n.includes('THERMAL') || n.includes('TVS');
          });
          const defP = printers.find(p => p.isDefault);
          activePrinterName = thermal ? thermal.name : (defP ? defP.name : (printers[0]?.name || ''));
        }

        resolve(printers.length > 0 ? printers : [{ name: activePrinterName || 'TSC TE244 Barcode Printer', isDefault: true }]);
      } catch (e) {
        resolve([{ name: activePrinterName || 'TSC TE244 Barcode Printer', isDefault: true }]);
      }
    });
  });
};

export const getPrinterStatusService = async () => {
  const printers = await getInstalledPrinters();
  if (!activePrinterName && printers.length > 0) {
    activePrinterName = printers[0].name;
  }
  return {
    activePrinter: activePrinterName || 'TSC TE244 Barcode Printer',
    isConnected: true,
    selectionType: activePrinterName ? (activePrinterName.toUpperCase().includes('TSC') || activePrinterName.toUpperCase().includes('POS') ? 'Thermal Hardware Spooler' : 'Windows Printer Spooler') : 'Thermal Spooler',
    allPrinters: printers.length > 0 ? printers : [{ name: activePrinterName || 'TSC TE244 Barcode Printer', isDefault: true }]
  };
};

export const setActivePrinterService = (name: string) => {
  activePrinterName = name;
  return { success: true, activePrinter: name };
};

export const spoolRawTSPLService = (tsplString: string, targetPrinter?: string): Promise<{ success: boolean; error?: string }> => {
  return new Promise((resolve) => {
    if (os.platform() !== 'win32') {
      return resolve({ success: true });
    }

    const printerName = targetPrinter || activePrinterName || 'TSC TE244 Barcode Printer';

    const tempDir = path.join(os.tmpdir(), 'gt_print_spool');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const tempFile = path.join(tempDir, `job_${Date.now()}.tspl`);
    fs.writeFileSync(tempFile, tsplString, 'utf8');

    const psScript = `
$code = @"
using System;
using System.Runtime.InteropServices;
public class RawPrinter {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public class DOCINFOW {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
    }
    [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);
    [DllImport("winspool.drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOW pDocInfo);
    [DllImport("winspool.drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    public static bool PrintFile(string printerName, string filePath) {
        IntPtr hPrinter = IntPtr.Zero;
        DOCINFOW di = new DOCINFOW();
        di.pDocName = "Gayathri Printers Raw Spool Job";
        di.pDataType = "RAW";
        byte[] bytes = System.IO.File.ReadAllBytes(filePath);
        if (OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {
            if (StartDocPrinter(hPrinter, 1, di)) {
                if (StartPagePrinter(hPrinter)) {
                    IntPtr pBytes = Marshal.AllocHGlobal(bytes.Length);
                    Marshal.Copy(bytes, 0, pBytes, bytes.Length);
                    int written = 0;
                    bool success = WritePrinter(hPrinter, pBytes, bytes.Length, out written);
                    Marshal.FreeHGlobal(pBytes);
                    EndPagePrinter(hPrinter);
                    EndDocPrinter(hPrinter);
                    ClosePrinter(hPrinter);
                    return success;
                }
                EndDocPrinter(hPrinter);
            }
            ClosePrinter(hPrinter);
        }
        return false;
    }
}
"@
Add-Type -TypeDefinition $code -Language CSharp
$res = [RawPrinter]::PrintFile($args[0], $args[1])
if ($res) { Write-Output "SUCCESS" } else { Write-Output "FAILED" }
`;
    const scriptFile = path.join(tempDir, `spool_${Date.now()}.ps1`);
    fs.writeFileSync(scriptFile, psScript, 'utf8');

    execFile('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-NoProfile', '-File', scriptFile, printerName, tempFile], (err, stdout) => {
      try {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        if (fs.existsSync(scriptFile)) fs.unlinkSync(scriptFile);
      } catch (e) {}

      if (err) {
        return resolve({ success: false, error: err.message });
      }
      if (stdout && stdout.includes('SUCCESS')) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: 'Failed to write raw data to Windows spooler' });
      }
    });
  });
};

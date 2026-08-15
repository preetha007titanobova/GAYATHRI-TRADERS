import React, { createContext, useContext, useState, useEffect } from 'react';

export interface LicenseFeatures {
  billing: boolean;
  inventory: boolean;
  barcode_printing: boolean;
  thermal_printing: boolean;
  whatsapp_invoice: boolean;
  daily_sales_report: boolean;
  gst_reports: boolean;
  multiple_users: boolean;
  cloud_backup: boolean;
  biometric: boolean;
}

interface LicenseContextType {
  isActivated: boolean;
  features: LicenseFeatures | null;
  daysRemaining: number;
  hasFeature: (feature: keyof LicenseFeatures) => boolean;
  loading: boolean;
  shopName: string;
  licenseKey: string;
  expiresAt: string | null;
  planType: string;
  machineId: string;
  isWhatsAppAllowed: boolean;
  isBiometricAllowed: boolean;
}

const LicenseContext = createContext<LicenseContextType | null>(null);

export const LicenseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isActivated, setIsActivated] = useState(false);
  const [features, setFeatures] = useState<LicenseFeatures | null>(null);
  const [daysRemaining, setDaysRemaining] = useState(9999);
  const [loading, setLoading] = useState(true);
  const [shopName, setShopName] = useState(localStorage.getItem('registered_shop_name') || localStorage.getItem('shop_name') || '');
  const [licenseKey, setLicenseKey] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [planType, setPlanType] = useState('');
  const [machineId, setMachineId] = useState('');

  useEffect(() => {
    // Helper to send initial license check request
    const checkLicense = () => {
      if ((window as any).api) {
        (window as any).api.send('get-license-status');
        (window as any).api.send('get-machine-id');
      } else {
        // Fallback for browser testing if not inside Electron
        setLoading(false);
        setIsActivated(true);
        setDaysRemaining(9999);
        localStorage.setItem('license_valid', 'true');
        localStorage.setItem('license_days_remaining', '9999');
        setMachineId('DEV-MODE-BROWSER-ID-9821');
      }
    };

    if ((window as any).api) {
      (window as any).api.receive('license-status-response', (event: any, arg: any) => {
        if (arg && arg.valid) {
          setIsActivated(true);
          setFeatures(arg.data.features);
          const activeShopName = arg.data.shopName || localStorage.getItem('registered_shop_name') || localStorage.getItem('shop_name') || '';
          setShopName(activeShopName);
          if (activeShopName) localStorage.setItem('registered_shop_name', activeShopName);
          setLicenseKey(arg.data.licenseKey || '');
          setPlanType(arg.data.planType || '');
          if (arg.data.expiresAt) {
            setExpiresAt(arg.data.expiresAt);
            const diffTime = new Date(arg.data.expiresAt).getTime() - Date.now();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            setDaysRemaining(diffDays);

            if (diffDays > 0) {
              localStorage.setItem('license_valid', 'true');
              localStorage.setItem('license_days_remaining', diffDays.toString());
            } else {
              localStorage.setItem('license_valid', 'false');
              localStorage.setItem('license_days_remaining', '0');
            }
          } else {
            setExpiresAt(null);
            setDaysRemaining(9999); // No expiry (e.g. lifetime)
            localStorage.setItem('license_valid', 'true');
            localStorage.setItem('license_days_remaining', '9999');
          }
        } else {
          setIsActivated(false);
          setFeatures(null);
          setDaysRemaining(0);
          setShopName(localStorage.getItem('registered_shop_name') || localStorage.getItem('shop_name') || '');
          setLicenseKey('');
          setPlanType('');
          setExpiresAt(null);
          localStorage.setItem('license_valid', 'false');
          localStorage.setItem('license_days_remaining', '0');
        }
        setLoading(false);
      });

      (window as any).api.receive('machine-id-response', (event: any, id: string) => {
        setMachineId(id);
      });
    }

    checkLicense();
  }, []);

  // Online verification sync to auto-disconnect if account was deleted or revoked in Admin Portal
  useEffect(() => {
    if (!licenseKey || !machineId || !navigator.onLine) return;

    const LICENSE_SERVER_URL = (import.meta as any).env?.VITE_LICENSE_SERVER_URL || 'https://ithu-namma-kada-license-server.onrender.com';

    const syncLicenseWithServer = async () => {
      try {
        const res = await fetch(`${LICENSE_SERVER_URL}/api/license/verify-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ licenseKey, machineId })
        });

        const data = await res.json();

        // Account deleted on Admin Portal, suspended, or deactivated
        if (!res.ok || data.active === false || data.success === false) {
          console.warn('License revoked or account deleted on Admin Portal server. Revoking local activation...');
          setIsActivated(false);
          setFeatures(null);
          setDaysRemaining(0);
          localStorage.setItem('license_valid', 'false');
          localStorage.setItem('license_days_remaining', '0');

          if ((window as any).api) {
            (window as any).api.send('revoke-license');
          }
        } else if (data.features) {
          // Sync latest features from server (e.g., if WhatsApp feature was toggled off in Admin Portal)
          setFeatures(data.features);
        }
      } catch (err) {
        // Quietly fail network errors so app works smoothly offline when disconnected
      }
    };

    syncLicenseWithServer();
  }, [licenseKey, machineId, shopName]);

  const hasFeature = (feature: keyof LicenseFeatures): boolean => {
    if (!isActivated) return false;
    if (!features) return true; // Fallback for legacy keys without feature map
    return !!features[feature];
  };

  const isWhatsAppAllowed = isActivated && daysRemaining > 0 && hasFeature('whatsapp_invoice');
  const isBiometricAllowed = isActivated && daysRemaining > 0 && hasFeature('biometric');

  return (
    <LicenseContext.Provider value={{ 
      isActivated, 
      features, 
      daysRemaining, 
      hasFeature, 
      loading, 
      shopName,
      licenseKey,
      expiresAt,
      planType,
      machineId,
      isWhatsAppAllowed,
      isBiometricAllowed
    }}>
      {children}
    </LicenseContext.Provider>
  );
};

export const useLicense = () => {
  const context = useContext(LicenseContext);
  if (!context) throw new Error('useLicense must be used within a LicenseProvider');
  return context;
};

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
}

interface LicenseContextType {
  isActivated: boolean;
  features: LicenseFeatures | null;
  daysRemaining: number;
  hasFeature: (feature: keyof LicenseFeatures) => boolean;
  loading: boolean;
  shopName: string;
}

const LicenseContext = createContext<LicenseContextType | null>(null);

export const LicenseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isActivated, setIsActivated] = useState(false);
  const [features, setFeatures] = useState<LicenseFeatures | null>(null);
  const [daysRemaining, setDaysRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [shopName, setShopName] = useState('SRI GAYATHRI TRADERS');

  useEffect(() => {
    // Helper to send initial license check request
    const checkLicense = () => {
      if ((window as any).api) {
        (window as any).api.send('get-license-status');
      } else {
        // Fallback for browser testing if not inside Electron
        setLoading(false);
      }
    };

    if ((window as any).api) {
      (window as any).api.receive('license-status-response', (event: any, arg: any) => {
        if (arg && arg.valid) {
          setIsActivated(true);
          setFeatures(arg.data.features);
          setShopName(arg.data.shopName || 'SRI GAYATHRI TRADERS');
          if (arg.data.expiresAt) {
            const diffTime = new Date(arg.data.expiresAt).getTime() - Date.now();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            setDaysRemaining(diffDays);
          } else {
            setDaysRemaining(9999); // No expiry (e.g. lifetime)
          }
        } else {
          setIsActivated(false);
          setFeatures(null);
          setDaysRemaining(0);
          setShopName('SRI GAYATHRI TRADERS');
        }
        setLoading(false);
      });
    }

    checkLicense();
  }, []);

  const hasFeature = (feature: keyof LicenseFeatures): boolean => {
    if (!isActivated || !features) return false;
    return !!features[feature];
  };

  return (
    <LicenseContext.Provider value={{ isActivated, features, daysRemaining, hasFeature, loading, shopName }}>
      {children}
    </LicenseContext.Provider>
  );
};

export const useLicense = () => {
  const context = useContext(LicenseContext);
  if (!context) throw new Error('useLicense must be used within a LicenseProvider');
  return context;
};

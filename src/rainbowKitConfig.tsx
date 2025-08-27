'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { darkTheme } from '@rainbow-me/rainbowkit';

import { isBrowser } from '@/utils/environment';
import { seiTestnet } from 'viem/chains';

// Only create config on client side
const createConfig = () => {
  if (!isBrowser) {
    return null;
  }

  return getDefaultConfig({
    appName: 'Seipad',
    projectId: process.env.NEXT_PUBLIC_PROJECT_ID!,
    chains: [seiTestnet],
    ssr: false,
  });
};

export default createConfig;

// Custom RainbowKit theme
export const customTheme = darkTheme({
  accentColor: '#9D1F19',
  accentColorForeground: '#1A1A1A',
  borderRadius: 'medium',
  fontStack: 'system',
  overlayBlur: 'small',
});

// Update colors to match our theme
customTheme.colors.actionButtonBorder = 'rgba(255, 255, 255, 0.1)';
customTheme.colors.actionButtonBorderMobile = 'rgba(255, 255, 255, 0.1)';
customTheme.colors.actionButtonSecondaryBackground = '#2A2A2A';
customTheme.colors.closeButton = '#FFFFFF';
customTheme.colors.closeButtonBackground = '#1A1A1A';
customTheme.colors.connectButtonBackground = '#9D1F19';
customTheme.colors.connectButtonBackgroundError = '#FF4444';
customTheme.colors.connectButtonInnerBackground = '#1A1A1A';
customTheme.colors.connectButtonText = '#ffffff';
customTheme.colors.connectButtonTextError = '#ffffff';
customTheme.colors.connectionIndicator = '#9D1F19';
customTheme.colors.downloadBottomCardBackground = '#1A1A1A';
customTheme.colors.downloadTopCardBackground = '#2A2A2A';
customTheme.colors.error = '#FF4444';
customTheme.colors.generalBorder = '#rgba(157, 31, 25, 0.2)';
customTheme.colors.generalBorderDim = 'rgba(255, 255, 255, 0.05)';
customTheme.colors.menuItemBackground = '#2A2A2A';
customTheme.colors.modalBackdrop = 'rgba(0, 0, 0, 0.6)';
customTheme.colors.modalBackground = '#1A1A1A';
customTheme.colors.modalBorder = 'rgba(157, 31, 25, 0.2)';
customTheme.colors.modalText = '#ffffff';
customTheme.colors.modalTextDim = '#AAAAAA';
customTheme.colors.modalTextSecondary = '#CCCCCC';
customTheme.colors.profileAction = '#2A2A2A';
customTheme.colors.profileActionHover = '#3A3A3A';
customTheme.colors.profileForeground = '#1A1A1A';
customTheme.colors.selectedOptionBorder = 'rgba(157, 31, 25, 0.3)';
customTheme.colors.standby = '#9D1F19';

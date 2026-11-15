/// <reference path="../assets.d.ts" />
import React from 'react';
import studioLumiLogo from '../../../resources/lumi-taskbar.png';

export const SplashScreen: React.FC = () => (
  <main className="lumi-splash" aria-label="Iniciando Estudio Lumi" aria-busy="true">
    <div className="lumi-splash__glow" aria-hidden="true" />
    <div className="lumi-splash__content">
      <img
        className="lumi-splash__logo"
        src={studioLumiLogo}
        alt="Logotipo oficial de Estudio Lumi"
        width="160"
        height="160"
      />
      <h1>ESTUDIO LUMI</h1>
      <p>Iniciando Estudio Lumi...</p>
      <div className="lumi-splash__loader" aria-hidden="true"><span /></div>
    </div>
  </main>
);


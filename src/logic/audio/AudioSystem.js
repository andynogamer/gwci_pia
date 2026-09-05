/**
 * Agent-Logic — REQ-SND-ITM Web Audio playback (BGM + SFX).
 * Volumes from SETTINGS_UPDATED. No DOM.
 */
export class AudioSystem {
  constructor() {
    this.masterVolume = 1;
    this.sfxVolume = 1;
  }

  applySettings({ masterVolume, sfxVolume }) {
    this.masterVolume = masterVolume;
    this.sfxVolume = sfxVolume;
  }

  playBgm() {}
  playSfx(_name) {}
}

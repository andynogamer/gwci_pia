/**
 * Agent-Logic — REQ-AI-PART + REQ-DIFF
 * FOV: vector dot product. LOS: THREE.Raycaster.
 * FSM: Patrol, Investigate, Pursue, Engage.
 */
export const AiState = Object.freeze({
  PATROL: 'PATROL',
  INVESTIGATE: 'INVESTIGATE',
  PURSUE: 'PURSUE',
  ENGAGE: 'ENGAGE',
});

export class EnemyAI {
  constructor(difficultyConfig) {
    this.config = difficultyConfig;
    this.state = AiState.PATROL;
  }

  /**
   * @param {number} _dt
   */
  update(_dt) {}
}

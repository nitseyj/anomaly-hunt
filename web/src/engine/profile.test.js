import { describe, it, expect } from 'vitest';
import { weakestSkillType } from './profile.js';

function profileWithSkills(skills) {
  return { skills };
}

describe('weakestSkillType', () => {
  it('picks the anomaly type with the lowest hit ratio', () => {
    const type = weakestSkillType(
      profileWithSkills({ pointSpike: 0.9, levelShift: 0.3, missingGap: 0.7, trendBreak: 0.6 })
    );
    expect(type).toBe('level_shift');
  });

  it('ignores types with no recorded history (null) instead of treating null as 0', () => {
    const type = weakestSkillType(
      profileWithSkills({ pointSpike: 0.5, levelShift: null, missingGap: 0.8, trendBreak: 0.4 })
    );
    expect(type).toBe('trend_break');
  });

  it('returns null when every skill is null (no hunt history yet)', () => {
    const type = weakestSkillType(
      profileWithSkills({ pointSpike: null, levelShift: null, missingGap: null, trendBreak: null })
    );
    expect(type).toBeNull();
  });
});

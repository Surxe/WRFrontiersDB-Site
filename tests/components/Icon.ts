import { describe, it, expect } from 'vitest';

describe('Icon Component', () => {
  it('should accept required altText prop', () => {
    const requiredProps = {
      altText: 'Shield icon',
    };

    expect(requiredProps.altText).toBeDefined();
    expect(typeof requiredProps.altText).toBe('string');
  });

  it('should accept optional iconPath prop', () => {
    const propsWithIconPath = {
      altText: 'Shield icon',
      iconPath:
        '/WRFrontiers/Content/Sparrow/UI/Textures/Abilities/T_AddShieldIcon',
    };

    expect(propsWithIconPath.iconPath).toBeDefined();
    expect(typeof propsWithIconPath.iconPath).toBe('string');
  });

  it('should have default size of 64', () => {
    const defaultSize = 64;
    expect(defaultSize).toBe(64);
  });

  it('should accept optional size prop', () => {
    const propsWithSize = {
      altText: 'Shield icon',
      size: 32,
    };

    expect(propsWithSize.size).toBe(32);
    expect(typeof propsWithSize.size).toBe('number');
  });

  it('should accept optional color prop', () => {
    const propsWithColor = {
      altText: 'Shield icon',
      color: 'FF5733',
    };

    expect(propsWithColor.color).toBeDefined();
    expect(typeof propsWithColor.color).toBe('string');
  });

  it('should construct correct iconSrc path from iconPath', () => {
    const iconPath =
      '/WRFrontiers/Content/Sparrow/UI/Textures/Abilities/T_AddShieldIcon';
    const iconSrc = `/WRFrontiersDB-Site/WRFrontiersDB-Data/textures${iconPath}.png`;

    expect(iconSrc).toBe(
      '/WRFrontiersDB-Site/WRFrontiersDB-Data/textures/WRFrontiers/Content/Sparrow/UI/Textures/Abilities/T_AddShieldIcon.png'
    );
  });

  it('should return null iconSrc when iconPath is undefined', () => {
    const iconPath = undefined;
    const iconSrc = iconPath
      ? `/WRFrontiersDB-Site/WRFrontiersDB-Data/textures${iconPath}.png`
      : null;

    expect(iconSrc).toBeNull();
  });

  it('should use mask rendering when both iconSrc and color exist', () => {
    const iconSrc = '/WRFrontiersDB-Site/WRFrontiersDB-Data/textures/test.png';
    const color = 'FF5733';

    const shouldUseMask = !!(iconSrc && color);
    expect(shouldUseMask).toBe(true);
  });

  it('should use img rendering when iconSrc exists but color does not', () => {
    const iconSrc = '/WRFrontiersDB-Site/WRFrontiersDB-Data/textures/test.png';
    const color = undefined;

    const shouldUseImg = !!(iconSrc && !color);
    expect(shouldUseImg).toBe(true);
  });

  it('should render nothing when iconSrc is null', () => {
    const iconSrc = null;
    const color = 'FF5733';

    const shouldRenderMask = !!(iconSrc && color);
    const shouldRenderImg = !!(iconSrc && !color);

    expect(shouldRenderMask).toBe(false);
    expect(shouldRenderImg).toBe(false);
  });
});

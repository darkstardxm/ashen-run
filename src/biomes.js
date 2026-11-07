// Biome table (values from assets/art/palettes.json and sky/*_gradient.json).
export const BIOME_LENGTH = 1000; // metres per biome
export const TRANSITION = 80;     // metres of fog/sky blend at the start of each biome

export const BIOMES = [
  {
    id: 'ashen_cathedral', name: 'The Ashen Cathedral',
    fog: 0x2c3648, density: 0.022,
    hemi: { sky: 0x3a4a66, ground: 0x14161c, intensity: 0.55 },
    key: { color: 0xa8bce0, intensity: 1.1, pos: [-6, 12, 6] },
    ember: 0xff8a3a, dust: 0x9aa4b8,
    scenery: ['clustered_pillar', 'candelabra', 'saint_statue', 'stained_glass_window'],
    pillar: 'clustered_pillar', arch: 'gothic_arch', signature: 'swinging_censer',
  },
  {
    id: 'ember_forge', name: 'The Ember Forge',
    fog: 0x3a1e14, density: 0.026,
    hemi: { sky: 0x2a1410, ground: 0x7a2a10, intensity: 0.6 },
    key: { color: 0xff9a5a, intensity: 1.0, pos: [0, -2, 10] },
    ember: 0xff6a1a, dust: 0x3a3230,
    scenery: ['basalt_pillar', 'brazier', 'anvil', 'furnace', 'hanging_chains'],
    pillar: 'basalt_pillar', arch: null, signature: 'fire_jet_vent',
  },
  {
    id: 'bone_catacombs', name: 'The Bone Catacombs',
    fog: 0x2e352c, density: 0.03,
    hemi: { sky: 0x3a4436, ground: 0x121410, intensity: 0.6 },
    key: { color: 0xb8c8a0, intensity: 0.8, pos: [0, 14, 2] },
    ember: 0x7dff9a, dust: 0x8a9478,
    scenery: ['ossuary_pillar', 'bone_pile', 'sarcophagus', 'skull_wall', 'soulfire_brazier'],
    pillar: 'ossuary_pillar', arch: 'crypt_arch', signature: 'collapsing_ceiling',
  },
];

export const biomeIndexAt = (d) => Math.floor(Math.max(0, d) / BIOME_LENGTH) % BIOMES.length;

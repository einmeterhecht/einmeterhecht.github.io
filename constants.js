const CELLS_X = 128;
const CELLS_Y = 128;

const FRAMES_PER_SECOND = 32; // Seems to be limited to 30
const ITERATIONS_PER_SECOND = 6;

const LOG_FPS = false;

const SKIP_FIRST_ITERATIONS = 6;
const ONLY_RUN_MAINLOOP_ON_CLICK = false;

const SHADER_CONSTANTS = {
    "INVERSE_CELL_COUNT" : "vec2(" + 1./CELLS_X + ", " + 1./CELLS_Y + ")",

    "PROBABILITY_FOR_HOT_SPOT" : "0.15", // orig. 0.06
    "HOT_SPOT_HEAT" : "9.0", // orig. 9.0
    "COLD_CELL_HEAT" : "0.5", // orig. 0.5

    "RADIUS" : 5, // orig. 3
    "HEAT_PERCENTAGE_EXCHANGED" : "0.8", // orig. 0.4
    "COMPARISON_FACTOR_FOR_HOT_CELL" : "3.8", // orig. 2.
    
    "BASE_HEATLOSS" : "0.08", // orig. 0.1
    "SURROUNDINGWARMTH_IMPACT_ON_HEATLOSS" : "1.0", // orig. 10.

    "MINIMAL_HEAT_BEFORE_BOOST" : "0.18", // orig. 0.15
    "BOOST_STRENGTH" : "1.2", // orig. 2.
    "BOOST_DECAY" : "0.75", // orig. 0.7

    "//INSERT_PACK_FUNCTIONS_HERE" : "float unpack_heat(vec4 heat_boost_dHeatdt_rgba) { // heat is within range 0. - 15.; high byte in r, low byte in g \nreturn (heat_boost_dHeatdt_rgba.r * 256. + heat_boost_dHeatdt_rgba.g) * 15. / 257.; //Actually *255./65535.*15.\n}\n float unpack_boost(vec4 heat_boost_dHeatdt_rgba) { // boost is within range 0 - 2; stored in b \nreturn heat_boost_dHeatdt_rgba.b * 2.; \n}\n float unpack_dHeatdt(vec4 heat_boost_dHeatdt_rgba) { // dHeatdt is within range -16 - 16; stored in a \nreturn heat_boost_dHeatdt_rgba.a * 32. - 16.; \n}\n vec3 unpack_heat_boost_dHeatdt(vec4 heat_boost_dHeatdt_rgba) { \n  return vec3(unpack_heat(heat_boost_dHeatdt_rgba), unpack_boost(heat_boost_dHeatdt_rgba), unpack_dHeatdt(heat_boost_dHeatdt_rgba)); \n}\n vec2 pack_heat(float heat) { \nreturn vec2(floor(heat * 17.) / 255., fract(heat * 17.)); \n}\n float pack_boost(float boost) { \nreturn boost * .5; \n}\n float pack_dHeatdt(float dHeatdt) { \nreturn (dHeatdt + 16.) * 0.03125; \n}\n float unpack_surroundingWarmth(vec2 surroundingWarmth_split) { // surroundingWarmth is within range 0. - 30.; high byte in r, low byte in g \nreturn (surroundingWarmth_split.r * 256. + surroundingWarmth_split.g) * 30. / 257.; \n}\n vec2 pack_surroundingWarmth(float surroundingWarmth) { \nreturn vec2(floor(surroundingWarmth * 8.5) / 255., fract(surroundingWarmth * 8.5)); \n}"
}

const CELLS_X = 128;
const CELLS_Y = 128;

const ITERATIONS_PER_SECOND = 10;

const SHADER_CONSTANTS = {
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

    "INSERT_PACK_FUNCTIONS_HERE" : "float unpack_heat(vec4 heat_boost_rgba) { // heat is within range 0 - 16; high byte in r, low byte in g \nreturn heat_boost_rgba.r * 16. + heat_boost_rgba.g * 0.0625; \n}\n float unpack_boost(vec4 heat_boost_rgba) { // boost is within range 0 - 8; high byte in b, low byte in a \nreturn heat_boost_rgba.b * 8. + heat_boost_rgba.a * 0.0375; \n}\n vec2 pack_heat(float heat) { \nreturn vec2(floor(heat * 16.) / 256., fract(heat * 16.)); \n}\n vec2 pack_boost(float boost) { \nreturn vec2(floor(boost * 32.) / 256., fract(boost * 32.)); \n}\n float unpack_surroundingWarmth(vec2 surroundingWarmth_split) { // surroundingWarmth is within range 0 - 32; high byte in r, low byte in g \nreturn surroundingWarmth_split.r * 32. + surroundingWarmth_split.g*0.125; \n}\n vec2 pack_surroundingWarmth(float surroundingWarmth_float) { \nreturn vec2(floor(surroundingWarmth_float*8.)/256., fract(surroundingWarmth_float*8.)); \n}"
}
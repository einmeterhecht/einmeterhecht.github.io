/*
(c) 2023 einmeterhecht

This is my first WebGL project, so much of the code is a copy from a tutorial.
Credits go to those three sites:

https://webglfundamentals.org/webgl/lessons/webgl-render-to-texture.html
https://antongerdelan.net/opengl/webgl_starter.html
https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Adding_2D_content_to_a_WebGL_context

Apologies for the code being so hard to read. If this is your question, the algorithm is not elegant.
If you want to modify it, play around with the values in constants.js.
The shaders are in the index.html file. Most of the logic happens there.

Program structure:
- Initialisation
- Set some cells red (randomised)
- Main loop
  - Calculate the surrounding warmth for each cell (draw it to the surroundingWarmth texture)
  - Exchange heat between the cells.
    - Each cell gives off a certain percentageof its heat to nearby cells but also receives heat from them.
    - Cells that are already warm receive a higher share of the heat given off.
      - The share that a cell gets is sqrt(heat_of_that_cell)/distance_to_that_cell_squared
      - Cells that are 3.8 times as hot as this cell or more only receive 1./distance_to_that_cell_squared
      - The sum of these values is surroundingWarmth.
    - All cells lose energy. Cells that are in a warm surrounding (determined by surroundingWarmth) lose less energy.
    - Cells that get to cold receive a "boost" Their boost value is set to BOOST_STRENGTH. Within the next iterations:
      - The boost value is added to their heat and then decreased to 75% of its value
      - Once the boost value drops below 0.4, they no longer receive the boost but lose heat as normal
  
  heat and boost are stored in one texture. There are two of those textures:
    - One stores the current values, the results of this iteration are rendered to the other one.
    - Each generation, they are swapped.
*/
console.log("Starting WebGL");

window.requestAnimFrame =(function() {
    return window.requestAnimationFrame ||
      window.webkitRequestAnimationFrame ||
      window.mozRequestAnimationFrame ||
      window.oRequestAnimationFrame ||
      window.msRequestAnimationFrame ||
      function(callback, element) {
        return window.setTimeout(callback, 2000/*1000 / 60*/);
      };
    })();

var canvas = document.getElementById("mycanvas");
canvas.width = 512;
canvas.height = 512;
var gl = canvas.getContext("webgl");

gl.clearColor(0., 0., 0.2, 1.0);
gl.clear(gl.COLOR_BUFFER_BIT);
gl.disable(gl.DEPTH_TEST)

function load_vertexbuffer() {
  const square_vertices = [1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, -1.0];
  position_buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, position_buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(square_vertices), gl.STATIC_DRAW);
  return position_buffer;
}

function bind_square_vertexbuffer(location_vp){
  gl.bindBuffer(gl.ARRAY_BUFFER, square_vertex_buffer);
  gl.vertexAttribPointer(
    location_vp,
    2,
    gl.FLOAT,
    false,
    0,
    0
  );
  gl.enableVertexAttribArray(location_vp);
}

function empty_texture(width, height, format){
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, 0, format, gl.UNSIGNED_BYTE, null);
    console.log("texture loaded ");
    return texture;
}

function create_framebuffer(render_target_texture) {
  // https://webglfundamentals.org/webgl/lessons/webgl-render-to-texture.html
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
 
  // attach the texture as the first color attachment
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, render_target_texture, 0);
  return framebuffer;
}

function compile_shaders_to_program(vertexshader_id, fragmentshader_id) {
  vs = gl.createShader(gl.VERTEX_SHADER);
  fs = gl.createShader(gl.FRAGMENT_SHADER);

  vertexshader_string = document.getElementById(vertexshader_id).innerHTML;
  fragmentshader_string = document.getElementById(fragmentshader_id).innerHTML;

  for (shader_constant in SHADER_CONSTANTS) {
    vertexshader_string = vertexshader_string.replaceAll(
      shader_constant, SHADER_CONSTANTS[shader_constant]);
    fragmentshader_string = fragmentshader_string.replaceAll(
      shader_constant, SHADER_CONSTANTS[shader_constant]);
  }
  //console.log(fragmentshader_string);
  gl.shaderSource(vs, vertexshader_string);
  gl.shaderSource(fs, fragmentshader_string);
  gl.compileShader(vs);
  if(!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
    console.error("ERROR compiling vert shader " + vertexshader_id + ". log: " +
      gl.getShaderInfoLog(vs));
      console.log(vertexshader_string);
  }
  gl.compileShader(fs);
  if(!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    console.error("ERROR compiling frag shader " + fragmentshader_id + ". log: " +
      gl.getShaderInfoLog(fs));
      console.log(fragmentshader_string);
  }
  shader_program = gl.createProgram();
  gl.attachShader(shader_program, vs);
  gl.attachShader(shader_program, fs);
  gl.bindAttribLocation(shader_program, 0, "vp");
  gl.linkProgram(shader_program);
  if(!gl.getProgramParameter(shader_program, gl.LINK_STATUS)) {
    console.error("ERROR linking program. log: " + gl.getProgramInfoLog(shader_program));
  }
  gl.validateProgram(shader_program);
  if(!gl.getProgramParameter(shader_program, gl.VALIDATE_STATUS)) {
    console.error("ERROR validating program. log: " +
      gl.getProgramInfoLog(shader_program));
  }
  return shader_program;
}

var square_vertex_buffer = load_vertexbuffer();

// heat in RG,  boost in BA
heat_boost_0 = empty_texture(CELLS_X, CELLS_Y, gl.RGBA);
heat_boost_1 = empty_texture(CELLS_X, CELLS_Y, gl.RGBA);

// surroundingWarmth in RG, but GL requires three components for a render target
surroundingWarmth = empty_texture(CELLS_X, CELLS_Y, gl.RGB);

render_to_heat_boost_0 = create_framebuffer(heat_boost_0);
render_to_heat_boost_1 = create_framebuffer(heat_boost_1);
render_to_surroundingWarmth = create_framebuffer(surroundingWarmth);

var initialise_heat_program = compile_shaders_to_program(
  "vertexshader_passthrough_2d.glsl",
  "fragmentshader_initialise_heat.glsl"
);

var calc_surroundingWarmth_program = compile_shaders_to_program(
  "vertexshader_passthrough_2d.glsl",
  "fragmentshader_calc_surroundingWarmth.glsl"
);

var calc_next_heat_boost_program = compile_shaders_to_program(
  "vertexshader_passthrough_2d.glsl",
  "fragmentshader_calc_next_heat_boost.glsl"
);

var heatToScreen_program = compile_shaders_to_program(
  "vertexshader_passthrough_2d.glsl",
  "fragmentshader_heat_to_screen.glsl"
);

gl.bindFramebuffer(gl.FRAMEBUFFER, render_to_heat_boost_0);
gl.viewport(0, 0, CELLS_X, CELLS_Y);

gl.useProgram(initialise_heat_program);

bind_square_vertexbuffer(gl.getAttribLocation(initialise_heat_program, "vp"));
gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
/*
gl.clearColor(0., 1., 1., 1.);
gl.clear(gl.COLOR_BUFFER_BIT);
*/

var location_heat_in_heatToScreen_program = gl.getUniformLocation(heatToScreen_program, "currentHeat");
var location_vp_in_heatToScreen_program = gl.getAttribLocation(heatToScreen_program, "vp");
var location_inverseCanvasSize_in_heatToScreen_program = gl.getUniformLocation(heatToScreen_program, "inverseCanvasSize");

var location_heat_boost_in_calc_surroundingWarmth_program = gl.getUniformLocation(
  calc_surroundingWarmth_program, "heat_boost");
var location_inverseCellCount_in_calc_surroundingWarmth_program = gl.getUniformLocation(
  calc_surroundingWarmth_program, "inverseCellCount");
var location_vp_in_calc_surroundingWarmth_program = gl.getAttribLocation(
  calc_surroundingWarmth_program, "vp");


var location_heat_boost_in_calc_next_heat_boost_program = gl.getUniformLocation(
  calc_next_heat_boost_program, "heat_boost");
var location_surroundingWarmth_in_calc_next_heat_boost_program = gl.getUniformLocation(
  calc_next_heat_boost_program, "surroundingWarmth");
var location_inverseCellCount_in_calc_next_heat_boost_program = gl.getUniformLocation(
  calc_next_heat_boost_program, "inverseCellCount");
var location_vp_in_calc_next_heat_boost_program = gl.getAttribLocation(
  calc_next_heat_boost_program, "vp");

var heat_boost_current = heat_boost_0;
var heat_boost_next = heat_boost_1;
render_to_heat_boost_next = render_to_heat_boost_1;

var iteration_index = 0;

var time_last_frame = performance.now();
function main_loop() {
  //console.log("Mainloop...");
  // update timers
  var current_millis = performance.now();
  var millis_since_last_frame = current_millis - time_last_frame;
  if (millis_since_last_frame < 1000/ITERATIONS_PER_SECOND) {
    // Only calculate a limited number of iterations each second
    window.requestAnimFrame(main_loop, canvas);
    return;
  }

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;


  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0., 0., 0.2, 1.);
  gl.clear(gl.COLOR_BUFFER_BIT);
  /*gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);*/
  gl.useProgram(heatToScreen_program);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, heat_boost_current);
  gl.uniform1i(location_heat_in_heatToScreen_program, 0);
  gl.uniform2f(location_inverseCanvasSize_in_heatToScreen_program, 1/1024, 1/1024);// 1./canvas.width, 1./canvas.height);
  bind_square_vertexbuffer(location_vp_in_heatToScreen_program);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);


  // Calculate surrounding warmth for each cell
  gl.useProgram(calc_surroundingWarmth_program);
  
  gl.bindFramebuffer(gl.FRAMEBUFFER, render_to_surroundingWarmth);
  gl.viewport(0, 0, CELLS_X, CELLS_Y);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, heat_boost_current);
  gl.uniform1i(location_heat_boost_in_calc_surroundingWarmth_program, 0);

  gl.uniform2f(location_inverseCellCount_in_calc_surroundingWarmth_program,
    1./CELLS_X, 1./CELLS_Y);

  bind_square_vertexbuffer(location_vp_in_calc_surroundingWarmth_program);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  

  // Calculate next iteration for each cell
  gl.useProgram(calc_next_heat_boost_program);
  
  gl.bindFramebuffer(gl.FRAMEBUFFER, render_to_heat_boost_next);
  gl.viewport(0, 0, CELLS_X, CELLS_Y);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, heat_boost_current);
  gl.uniform1i(location_surroundingWarmth_in_calc_next_heat_boost_program, 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, surroundingWarmth);
  gl.uniform1i(location_surroundingWarmth_in_calc_next_heat_boost_program, 1);

  gl.uniform2f(location_inverseCellCount_in_calc_next_heat_boost_program,
    1./CELLS_X, 1./CELLS_Y);

  bind_square_vertexbuffer(location_vp_in_calc_next_heat_boost_program);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  
  // Swap buffers
  if (iteration_index % 2 == 0) {
    heat_boost_current = heat_boost_1;
    heat_boost_next = heat_boost_0;
    render_to_heat_boost_next = render_to_heat_boost_0;
  }
  else {
    heat_boost_current = heat_boost_0;
    heat_boost_next = heat_boost_1;
    render_to_heat_boost_next = render_to_heat_boost_1;
  }

  iteration_index++;

  time_last_frame = performance.now();
  
  // "automatically re-call this function please"
  window.requestAnimFrame(main_loop, canvas);
}

//canvas.onclick = main_loop;
main_loop();

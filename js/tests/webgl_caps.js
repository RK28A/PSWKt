/*
 * PSWKT - Sondes : capacites WebGL (extensions + parametres)
 * Sondes de presence d'extensions + quelques tests comportementaux de parametres.
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var R = PSWKT.runner;
  var F = PSWKT.factory;

  R.defineCategory('webglcaps', 'WebGL (capabilities)', 'Extensions and hardware parameters exposed by WebGL.');

  var EXTENSIONS = [
    'ANGLE_instanced_arrays', 'EXT_blend_minmax', 'EXT_color_buffer_float', 'EXT_color_buffer_half_float',
    'EXT_disjoint_timer_query', 'EXT_float_blend', 'EXT_frag_depth', 'EXT_shader_texture_lod',
    'EXT_sRGB', 'EXT_texture_compression_bptc', 'EXT_texture_compression_rgtc',
    'EXT_texture_filter_anisotropic', 'OES_element_index_uint', 'OES_fbo_render_mipmap',
    'OES_standard_derivatives', 'OES_texture_float', 'OES_texture_float_linear',
    'OES_texture_half_float', 'OES_texture_half_float_linear', 'OES_vertex_array_object',
    'WEBGL_color_buffer_float', 'WEBGL_compressed_texture_astc', 'WEBGL_compressed_texture_etc',
    'WEBGL_compressed_texture_etc1', 'WEBGL_compressed_texture_pvrtc', 'WEBGL_compressed_texture_s3tc',
    'WEBGL_compressed_texture_s3tc_srgb', 'WEBGL_debug_renderer_info', 'WEBGL_debug_shaders',
    'WEBGL_depth_texture', 'WEBGL_draw_buffers', 'WEBGL_lose_context', 'WEBGL_multi_draw',
    'KHR_parallel_shader_compile'
  ];

  for (var i = 0; i < EXTENSIONS.length; i++) {
    F.webglExtension('webglcaps', 'glext', EXTENSIONS[i]);
  }

  // Parametres materiels (comportementaux) : lisent une limite reelle du GPU.
  var PARAMS = [
    ['MAX_TEXTURE_SIZE', 'taille max de texture'],
    ['MAX_CUBE_MAP_TEXTURE_SIZE', 'taille max cube map'],
    ['MAX_RENDERBUFFER_SIZE', 'taille max renderbuffer'],
    ['MAX_VIEWPORT_DIMS', 'dimensions max viewport'],
    ['MAX_VERTEX_ATTRIBS', 'attributs de sommet max'],
    ['MAX_VERTEX_UNIFORM_VECTORS', 'uniform vectors sommet max'],
    ['MAX_FRAGMENT_UNIFORM_VECTORS', 'uniform vectors fragment max'],
    ['MAX_VARYING_VECTORS', 'varying vectors max'],
    ['MAX_TEXTURE_IMAGE_UNITS', 'unites de texture max'],
    ['MAX_COMBINED_TEXTURE_IMAGE_UNITS', 'unites de texture combinees max'],
    ['ALIASED_LINE_WIDTH_RANGE', 'plage largeur de ligne'],
    ['ALIASED_POINT_SIZE_RANGE', 'plage taille de point']
  ];

  for (var k = 0; k < PARAMS.length; k++) {
    (function (paramName, label) {
      R.register({
        id: 'glparam.' + F.idSafe(paramName),
        name: 'gl.' + paramName,
        category: 'webglcaps',
        description: 'Parametre WebGL : ' + label,
        requires: [],
        quiet: true,
        run: function () {
          var g = F.gl();
          if (!g) return { status: 'skip', detail: 'WebGL unavailable', measurements: { param: paramName } };
          var val = null;
          try { val = g.getParameter(g[paramName]); } catch (e) { val = null; }
          if (val && val.length !== undefined) val = Array.prototype.slice.call(val);
          var ok = (val !== null && val !== undefined);
          return {
            status: ok ? 'pass' : 'skip',
            detail: ok ? (label + ' = ' + val) : 'non lisible',
            measurements: { param: paramName, value: val }
          };
        }
      });
    })(PARAMS[k][0], PARAMS[k][1]);
  }

})(typeof window !== 'undefined' ? window : this);

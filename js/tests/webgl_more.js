/*
 * PSWKT - Sondes WebGL supplementaires (extensions WebGL1/WebGL2)
 * Complete la categorie "WebGL (capacites)". Non destructif.
 */
(function (global) {
  'use strict';
  var PSWKT = global.PSWKT;
  var F = PSWKT.factory;

  var EXTENSIONS = [
    // WebGL1 additionnelles
    'EXT_clip_cull_distance', 'EXT_conservative_depth', 'EXT_depth_clamp',
    'EXT_polygon_offset_clamp', 'EXT_render_snorm', 'EXT_texture_mirror_clamp_to_edge',
    'EXT_texture_norm16', 'OES_draw_buffers_indexed', 'WEBGL_blend_func_extended',
    'WEBGL_clip_cull_distance', 'WEBGL_multi_draw_instanced_base_vertex_base_instance',
    'WEBGL_provoking_vertex', 'WEBGL_shader_pixel_local_storage', 'WEBGL_stencil_texturing',
    'OVR_multiview2', 'WEBGL_compressed_texture_etc', 'WEBGL_compressed_texture_astc',
    // Compression texture (PS5/consoles)
    'WEBGL_compressed_texture_s3tc', 'WEBGL_compressed_texture_pvrtc',
    'EXT_texture_compression_bptc', 'EXT_texture_compression_rgtc',
    // Divers
    'EXT_disjoint_timer_query_webgl2', 'OES_texture_float_linear', 'EXT_float_blend',
    'KHR_parallel_shader_compile', 'WEBGL_debug_renderer_info', 'WEBGL_lose_context',
    'EXT_color_buffer_float', 'EXT_color_buffer_half_float'
  ];

  for (var i = 0; i < EXTENSIONS.length; i++) {
    F.webglExtension('webglcaps', 'glext2_' + i, EXTENSIONS[i]);
  }

})(typeof window !== 'undefined' ? window : this);

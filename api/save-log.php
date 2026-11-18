<?php
/* PSWKT - one-shot log/report saving (InfinityFree-compatible, no Python needed).
 * Writes the POST body into ../logs/ as a timestamped file. */
header('Content-Type: application/json; charset=utf-8');
$fmt  = isset($_GET['format']) ? $_GET['format'] : 'txt';
$name = isset($_GET['name'])   ? $_GET['name']   : 'log';
$base = preg_replace('/[^A-Za-z0-9._-]+/', '_', $name);
$base = substr(trim($base, '_'), 0, 60);
if ($base === '') $base = 'log';
$ext  = ($fmt === 'json') ? 'json' : 'txt';
$dir  = __DIR__ . '/../logs';
if (!is_dir($dir)) @mkdir($dir, 0775, true);
$fname = 'pswkt-' . $base . '-' . date('Ymd-His') . '.' . $ext;
$fpath = $dir . '/' . $fname;
$body  = file_get_contents('php://input');
if ($body === false || $body === '') { http_response_code(400); echo json_encode(array('ok'=>false,'error'=>'empty body')); exit; }
if (@file_put_contents($fpath, $body) === false) { http_response_code(500); echo json_encode(array('ok'=>false,'error'=>'write failed (check logs/ permissions)')); exit; }
echo json_encode(array('ok'=>true, 'path'=>'logs/' . $fname, 'bytes'=>strlen($body)));

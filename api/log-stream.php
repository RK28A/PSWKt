<?php
/* PSWKT - continuous logging (InfinityFree-compatible). Appends the POST body to
 * ../logs/pswkt-live-<session>.txt. init=1 truncates/creates the file. */
header('Content-Type: application/json; charset=utf-8');
$session = isset($_GET['session']) ? $_GET['session'] : 'session';
$init    = isset($_GET['init']) && ($_GET['init'] == '1');
$base = preg_replace('/[^A-Za-z0-9._-]+/', '_', $session);
$base = substr(trim($base, '_'), 0, 80);
if ($base === '') $base = 'session';
$dir = __DIR__ . '/../logs';
if (!is_dir($dir)) @mkdir($dir, 0775, true);
$fpath = $dir . '/pswkt-live-' . $base . '.txt';
$body  = file_get_contents('php://input');
if ($body === false) $body = '';
$flags = $init ? 0 : FILE_APPEND;
if (@file_put_contents($fpath, $body, $flags) === false) { http_response_code(500); echo json_encode(array('ok'=>false,'error'=>'append failed')); exit; }
echo json_encode(array('ok'=>true, 'path'=>'logs/pswkt-live-' . $base . '.txt', 'bytes'=>strlen($body), 'total'=>@filesize($fpath)));

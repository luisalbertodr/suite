<?php
/**
 * API CDR Issabel → Suite (issabel-calls Edge Function)
 * Ruta en servidor: /var/www/html_api/api_cdr.php
 *
 * Tras copiar: conserva $api_token_valido y credenciales DB del fichero anterior.
 *
 * Endpoints:
 *   GET ?limit=500&from=2026-06-01&to=2026-06-08        → JSON listado CDR
 *   GET ?format=wav&uniqueid=1780593561.132271          → audio WAV (por uniqueid CDR)
 *   GET ?file=rg-100-662584162-20260608-145040-....wav  → audio WAV (por nombre en monitor)
 */

declare(strict_types=1);

// --- Mantener estos valores del api_cdr.php actual en Issabel ---
$api_token_valido = 'CAMBIAR_POR_TOKEN_ACTUAL';
$db_user = 'asteriskuser';
$db_pass = 'CAMBIAR_POR_PASSWORD_ACTUAL';
$db_name = 'asteriskcdrdb';
// -----------------------------------------------------------------

function issabel_api_unauthorized(): void
{
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'No autorizado o token no valido']);
    exit;
}

function issabel_api_token_ok(string $expected): bool
{
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    if (!$auth && isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $auth = $_SERVER['HTTP_AUTHORIZATION'];
    }
    $token = preg_replace('/^Bearer\s+/i', '', trim((string) $auth));
    return $token !== '' && hash_equals($expected, $token);
}

function issabel_api_pdo(string $user, string $pass, string $db): PDO
{
    $dsn = "mysql:dbname=$db;unix_socket=/var/lib/mysql/mysql.sock";
    $pdo = new PDO($dsn, $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    return $pdo;
}

function issabel_api_valid_uniqueid(string $uid): bool
{
    return (bool) preg_match('/^[0-9]+\.[0-9]+$/', $uid);
}

function issabel_api_recording_roots(): array
{
    return [
        '/var/spool/asterisk/monitor',
        '/var/spool/asterisk/monitorDONE',
        '/var/spool/asterisk/voicemail',
    ];
}

function issabel_api_uniqueid_from_name(string $name): ?string
{
    if (preg_match('/(\d+\.\d+)(?:\.(?:wav|gsm|WAV|GSM))?$/', $name, $matches)) {
        return $matches[1];
    }
    return null;
}

function issabel_api_is_audio_file(string $path): bool
{
    return is_file($path) && preg_match('/\.(wav|gsm|WAV|GSM)$/i', $path);
}

function issabel_api_path_variants(string $recordingfile): array
{
    $basename = basename(trim($recordingfile));
    $variants = [$basename];
    if (preg_match('/^(.+)\.(wav|gsm)$/i', $basename, $matches)) {
        $stem = $matches[1];
        foreach (['wav', 'gsm', 'WAV', 'GSM'] as $ext) {
            $variants[] = $stem . '.' . $ext;
        }
    }
    return array_values(array_unique($variants));
}

function issabel_api_find_in_roots(array $roots, callable $match): ?string
{
    foreach ($roots as $root) {
        if (!is_dir($root)) {
            continue;
        }
        try {
            $iterator = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS)
            );
            foreach ($iterator as $file) {
                if (!$file->isFile()) {
                    continue;
                }
                $path = $file->getPathname();
                if ($match($path, $file->getFilename())) {
                    return $path;
                }
            }
        } catch (UnexpectedValueException $e) {
            continue;
        }
    }
    return null;
}

function issabel_api_resolve_recording_path(?string $recordingfile, ?string $uniqueid = null): ?string
{
    $roots = issabel_api_recording_roots();

    if ($recordingfile !== null && trim($recordingfile) !== '') {
        $recordingfile = trim($recordingfile);
        if (strpos($recordingfile, '..') !== false) {
            return null;
        }
        if ($recordingfile[0] === '/' && issabel_api_is_audio_file($recordingfile)) {
            return $recordingfile;
        }
        foreach ($roots as $root) {
            foreach (issabel_api_path_variants($recordingfile) as $name) {
                $path = rtrim($root, '/') . '/' . $name;
                if (issabel_api_is_audio_file($path)) {
                    return $path;
                }
            }
        }
    }

    $searchUid = $uniqueid ?: ($recordingfile ? issabel_api_uniqueid_from_name($recordingfile) : null);
    if (!$searchUid) {
        return null;
    }

    return issabel_api_find_in_roots($roots, static function (string $path, string $name) use ($searchUid): bool {
        return strpos($name, $searchUid) !== false && issabel_api_is_audio_file($path);
    });
}

function issabel_api_audio_content_type(string $path): string
{
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    return $ext === 'gsm' ? 'audio/gsm' : 'audio/wav';
}

function issabel_api_stream_path(string $path): void
{
    header('Content-Type: ' . issabel_api_audio_content_type($path));
    header('Content-Length: ' . (string) filesize($path));
    header('Cache-Control: private, max-age=3600');
    readfile($path);
    exit;
}

function issabel_api_diag_monitor(): void
{
    header('Content-Type: application/json');
    $roots = issabel_api_recording_roots();
    $report = [];
    foreach ($roots as $root) {
        $entry = ['root' => $root, 'exists' => is_dir($root), 'files' => 0, 'sample' => []];
        if (!is_dir($root)) {
            $report[] = $entry;
            continue;
        }
        try {
            $iterator = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS)
            );
            foreach ($iterator as $file) {
                if (!$file->isFile() || !issabel_api_is_audio_file($file->getPathname())) {
                    continue;
                }
                $entry['files']++;
                if (count($entry['sample']) < 3) {
                    $entry['sample'][] = $file->getPathname();
                }
            }
        } catch (UnexpectedValueException $e) {
            $entry['error'] = $e->getMessage();
        }
        $report[] = $entry;
    }
    echo json_encode(['status' => 'success', 'roots' => $report]);
    exit;
}

function issabel_api_stream_file(string $recordingfile): void
{
    $basename = basename(trim($recordingfile));
    if ($basename === '' || $basename === '.' || $basename === '..') {
        http_response_code(400);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'file invalido']);
        exit;
    }

    $path = issabel_api_resolve_recording_path($basename);
    if (!$path) {
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode([
            'error' => 'Fichero no encontrado en monitor',
            'recordingfile' => $basename,
        ]);
        exit;
    }

    issabel_api_stream_path($path);
}

function issabel_api_mailbox_from_vms_dst(string $dst): ?string
{
    if (preg_match('/^vms(\d+)$/i', trim($dst), $matches)) {
        return $matches[1];
    }
    return null;
}

function issabel_api_phone_tail_match(string $left, string $right): bool
{
    $a = preg_replace('/\D/', '', $left);
    $b = preg_replace('/\D/', '', $right);
    if ($a === '' || $b === '') {
        return false;
    }
    $min = min(strlen($a), strlen($b), 9);
    return $min >= 6 && (substr($a, -$min) === substr($b, -$min));
}

function issabel_api_parse_voicemail_message_txt(string $path): ?array
{
    if (!is_file($path)) {
        return null;
    }
    $content = file_get_contents($path);
    if ($content === false) {
        return null;
    }
    $origtime = 0;
    $duration = 0;
    $callerid = '';
    if (preg_match('/^origtime=(\d+)/m', $content, $matches)) {
        $origtime = (int) $matches[1];
    }
    if (preg_match('/^duration=(\d+)/m', $content, $matches)) {
        $duration = (int) $matches[1];
    }
    if (preg_match('/^callerid=(.+)$/m', $content, $matches)) {
        $callerid = trim($matches[1], " \"\t");
    }
    if ($origtime <= 0) {
        return null;
    }
    return [
        'origtime' => $origtime,
        'duration' => $duration,
        'callerid' => $callerid,
    ];
}

function issabel_api_voicemail_contexts(): array
{
    return ['default', 'internal', 'from-internal'];
}

function issabel_api_calldate_timestamp(string $calldate): ?int
{
    $dt = DateTime::createFromFormat('Y-m-d H:i:s', trim($calldate), new DateTimeZone('Europe/Madrid'));
    if ($dt instanceof DateTime) {
        return $dt->getTimestamp();
    }
    $fallback = strtotime($calldate);
    return $fallback === false ? null : $fallback;
}

function issabel_api_uniqueid_epoch(string $uniqueid): ?int
{
    if (preg_match('/^(\d+)\./', trim($uniqueid), $matches)) {
        return (int) $matches[1];
    }
    return null;
}

function issabel_api_voicemail_folders(): array
{
    return ['INBOX', 'Old', 'Urgent', 'tmp', 'WORK'];
}

function issabel_api_voicemail_mailboxes(string $preferred): array
{
    $boxes = [$preferred, '1001', '1002'];
    foreach (issabel_api_voicemail_contexts() as $context) {
        foreach (glob("/var/spool/asterisk/voicemail/$context/*", GLOB_ONLYDIR) ?: [] as $dir) {
            $boxes[] = basename($dir);
        }
    }
    return array_values(array_unique(array_filter($boxes)));
}

function issabel_api_voicemail_time_match(
    int $origtime,
    string $uniqueid,
    string $calldate,
    int $expectedDuration
): bool {
    $targets = [];
    $epoch = issabel_api_uniqueid_epoch($uniqueid);
    if ($epoch !== null) {
        $targets[] = $epoch;
        if ($expectedDuration > 0) {
            $targets[] = $epoch + $expectedDuration;
        }
    }
    $callTs = issabel_api_calldate_timestamp($calldate);
    if ($callTs !== null) {
        $targets[] = $callTs;
    }
    foreach ($targets as $target) {
        if (abs($origtime - $target) <= 300) {
            return true;
        }
    }
    return false;
}

function issabel_api_resolve_voicemail_path(
    string $mailbox,
    string $calldate,
    string $src,
    int $expectedDuration = 0,
    string $uniqueid = ''
): ?string {
    $bestPath = null;
    $bestScore = PHP_INT_MAX;
    $mailboxes = issabel_api_voicemail_mailboxes($mailbox);

    foreach (issabel_api_voicemail_contexts() as $context) {
        foreach ($mailboxes as $box) {
            foreach (issabel_api_voicemail_folders() as $folder) {
                $dir = "/var/spool/asterisk/voicemail/$context/$box/$folder";
                if (!is_dir($dir)) {
                    continue;
                }
                foreach (glob($dir . '/msg*.txt') ?: [] as $txtPath) {
                    $info = issabel_api_parse_voicemail_message_txt($txtPath);
                    if ($info === null) {
                        continue;
                    }
                    if ($uniqueid !== '' &&
                        !issabel_api_voicemail_time_match(
                            $info['origtime'],
                            $uniqueid,
                            $calldate,
                            $expectedDuration,
                        )) {
                        continue;
                    }
                    if (!issabel_api_phone_tail_match($src, $info['callerid'])) {
                        continue;
                    }
                    $callTs = issabel_api_calldate_timestamp($calldate) ?? $info['origtime'];
                    $score = abs($info['origtime'] - $callTs);
                    if ($expectedDuration > 0 && $info['duration'] > 0) {
                        $score += abs($info['duration'] - $expectedDuration) * 2;
                    }
                    if ($score >= $bestScore) {
                        continue;
                    }
                    $wavPath = preg_replace('/\.txt$/', '.wav', $txtPath);
                    if (!issabel_api_is_audio_file($wavPath)) {
                        continue;
                    }
                    $bestPath = $wavPath;
                    $bestScore = $score;
                }
            }
        }
    }

    return $bestPath;
}

function issabel_api_diag_voicemail(PDO $pdo, string $uniqueid): void
{
    header('Content-Type: application/json');
    $stmt = $pdo->prepare(
        "SELECT recordingfile, dst, calldate, src, billsec
         FROM cdr
         WHERE uniqueid = :uid OR linkedid = :uid
         ORDER BY CASE WHEN dst LIKE 'vms%' THEN 0 ELSE 1 END, billsec DESC"
    );
    $stmt->execute(['uid' => $uniqueid]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $matches = [];
    foreach ($rows as $row) {
        $mailbox = issabel_api_mailbox_from_vms_dst((string) ($row['dst'] ?? ''));
        if ($mailbox === null) {
            continue;
        }
        $path = issabel_api_resolve_voicemail_path(
            $mailbox,
            (string) ($row['calldate'] ?? ''),
            (string) ($row['src'] ?? ''),
            (int) ($row['billsec'] ?? 0),
            $uniqueid,
        );
        $matches[] = [
            'row' => $row,
            'resolved' => $path,
        ];
    }
    echo json_encode(['status' => 'success', 'uniqueid' => $uniqueid, 'cdr' => $rows, 'matches' => $matches]);
    exit;
}

function issabel_api_stream_wav(PDO $pdo, string $uniqueid): void
{
    if (!issabel_api_valid_uniqueid($uniqueid)) {
        http_response_code(400);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'uniqueid invalido']);
        exit;
    }

    $stmt = $pdo->prepare(
        "SELECT recordingfile, dst, calldate, src, billsec
         FROM cdr
         WHERE uniqueid = :uid
         ORDER BY CASE WHEN dst LIKE 'vms%' THEN 0 ELSE 1 END, billsec DESC"
    );
    $stmt->execute(['uid' => $uniqueid]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (!$rows) {
        $linkedStmt = $pdo->prepare(
            "SELECT recordingfile, dst, calldate, src, billsec
             FROM cdr
             WHERE linkedid = :uid
             ORDER BY CASE WHEN dst LIKE 'vms%' THEN 0 ELSE 1 END, billsec DESC"
        );
        $linkedStmt->execute(['uid' => $uniqueid]);
        $rows = $linkedStmt->fetchAll(PDO::FETCH_ASSOC);
    }

    foreach ($rows as $row) {
        $mailbox = issabel_api_mailbox_from_vms_dst((string) ($row['dst'] ?? ''));
        if ($mailbox === null) {
            continue;
        }
        $path = issabel_api_resolve_voicemail_path(
            $mailbox,
            (string) ($row['calldate'] ?? ''),
            (string) ($row['src'] ?? ''),
            (int) ($row['billsec'] ?? 0),
            $uniqueid,
        );
        if ($path) {
            issabel_api_stream_path($path);
        }
    }

    foreach ($rows as $row) {
        $recordingfile = trim((string) ($row['recordingfile'] ?? ''));
        if ($recordingfile === '') {
            continue;
        }
        $path = issabel_api_resolve_recording_path($recordingfile, $uniqueid);
        if ($path) {
            issabel_api_stream_path($path);
        }
    }

    $path = issabel_api_resolve_recording_path(null, $uniqueid);
    if ($path) {
        issabel_api_stream_path($path);
    }

    $fallbackRecording = '';
    foreach ($rows as $row) {
        if (!empty($row['recordingfile'])) {
            $fallbackRecording = (string) $row['recordingfile'];
            break;
        }
    }

    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode([
        'error' => 'Fichero no encontrado en monitor',
        'recordingfile' => $fallbackRecording,
        'uniqueid' => $uniqueid,
    ]);
    exit;
}

function issabel_api_list_cdr(PDO $pdo): void
{
    header('Content-Type: application/json');

    $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 100;
    if ($limit < 1) {
        $limit = 100;
    }
    if ($limit > 2000) {
        $limit = 2000;
    }

    $where = [];
    $params = [];

    if (!empty($_GET['from']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $_GET['from'])) {
        $where[] = 'calldate >= :from_date';
        $params['from_date'] = $_GET['from'] . ' 00:00:00';
    }
    if (!empty($_GET['to']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $_GET['to'])) {
        $where[] = 'calldate <= :to_date';
        $params['to_date'] = $_GET['to'] . ' 23:59:59';
    }

    $sql = 'SELECT calldate, clid, src, dst, dcontext, duration, billsec, disposition, uniqueid, linkedid, recordingfile
            FROM cdr';
    if ($where) {
        $sql .= ' WHERE ' . implode(' AND ', $where);
    }
    $sql .= ' ORDER BY calldate DESC LIMIT :limit';

    $stmt = $pdo->prepare($sql);
    foreach ($params as $key => $value) {
        $stmt->bindValue(':' . $key, $value);
    }
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();

    $cdrs = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['status' => 'success', 'data' => $cdrs]);
}

if (!issabel_api_token_ok($api_token_valido)) {
    issabel_api_unauthorized();
}

try {
    $pdo = issabel_api_pdo($db_user, $db_pass, $db_name);

    if (!empty($_GET['diag']) && $_GET['diag'] === 'monitor') {
        issabel_api_diag_monitor();
    }

    if (!empty($_GET['diag']) && $_GET['diag'] === 'voicemail' && !empty($_GET['uniqueid'])) {
        issabel_api_diag_voicemail($pdo, (string) $_GET['uniqueid']);
    }

    if (!empty($_GET['file'])) {
        issabel_api_stream_file((string) $_GET['file']);
    }

    if (isset($_GET['format']) && $_GET['format'] === 'wav' && !empty($_GET['uniqueid'])) {
        issabel_api_stream_wav($pdo, (string) $_GET['uniqueid']);
    }

    issabel_api_list_cdr($pdo);
} catch (PDOException $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Error de conexion a la base de datos: ' . $e->getMessage()]);
}

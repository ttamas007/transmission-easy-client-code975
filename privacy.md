# Privacy Policy - Transmission Easy Client code975

Effective date: November 14, 2026.

This policy describes the data handling of Transmission Easy Client code975,
including version 3.4.3. The extension is maintained by
[ttamas007](https://github.com/ttamas007) and lets you manage a Transmission
server that you configure. It does not provide a hosted Transmission service.

## 1. Data used by the extension

The extension processes the following information to provide its features:

- **Connection and authentication information:** your Transmission server's
  hostname or IP address, port, HTTP/HTTPS selection, RPC and Web UI paths, and,
  if you enable authentication, the username and password you enter.
- **Preferences and configuration:** language, theme, notification preferences,
  table layout, filters, destination directories, tracker-based seeding-time
  rules and related settings.
- **Torrent information:** torrent names and hashes, file names and paths,
  magnet links, torrent metadata, transfer speeds, progress, statistics,
  labels, tracker information, peer information and server diagnostics
  returned by your Transmission server. Tracker URLs or diagnostics may
  contain private information such as passkeys.
- **User-selected web resources:** torrent links, magnet links and torrent
  files that you explicitly choose to add. Retrieving a torrent file from
  a selected page may use that website's existing browser session, subject
  to browser security rules.
- **Operational state:** notification bookkeeping, torrent hashes used for
  seeding-rule exclusions, RPC session tokens and short-lived speed or
  request-timing information needed to operate the extension.

The extension does not read your complete browser history or continuously
monitor unrelated pages. Selected URLs and torrent resources are processed
when you use the relevant torrent-adding features.

## 2. Purposes and recipients

Data is used to connect to your server, display and control torrents, apply
your chosen settings and seeding rules, show notifications, and provide
backup and restore.

After you configure a connection, background checks may continue while Chrome
is running even when the extension's interface is closed.

- **Your Transmission server** receives RPC requests, authentication data
  when enabled, torrent files or links you submit, and settings or commands
  you apply. Its operator controls server-side storage, logs and retention.
- **Websites you choose** receive ordinary network requests when you ask
  the extension to retrieve a torrent file. Those websites may process
  information such as your IP address and applicable browser-session data.
- **Google Chrome synchronization** may receive configuration backups if
  you explicitly use the cloud-backup feature and Chrome Sync is enabled.
  See section 3.
- **Your operating system's notification service** may display torrent
  names and error messages if notifications are enabled.

The extension does not send torrent activity, credentials or browsing data
to a developer-operated analytics or collection service. It does not include
advertising, sell user data, or use user data for behavioral advertising,
creditworthiness assessments or lending.

Transmission itself may contact trackers, peers and other services according
to its configuration. Those server-side activities are separate from the
extension. Downloaded torrent payload files are handled by your Transmission
server; the extension can retrieve the small torrent metadata files used to
add downloads.

## 3. Local storage and optional cloud backup

Connection settings and preferences are stored in the extension's local
Chrome storage. Some operational records, including notification state and
seeding-rule exclusions, also persist locally. Short-lived information such
as RPC session tokens and speed history may be kept in Chrome session storage
or memory.

Cloud backup is optional and is started by the **Save in cloud** action.
Opening the backup page does not itself upload a new configuration backup.
The feature uses `chrome.storage.sync`, not a server operated by the maintainer.
When Chrome Sync is enabled, Google may synchronize the backup through your
Google account to other applicable browser installations. Without active
browser synchronization, Chrome manages this storage locally.

**Backups can contain your server address, username, password and directory
paths.** The extension does not add its own encryption to local configuration
or backup contents. It relies on the browser and operating system's storage
and account protections and must not be treated as a password manager.
Configuration displayed or copied from the backup page may contain secrets:
do not publish it or include it in public support reports.

Google's handling of its services is described in the
[Google Privacy Policy](https://policies.google.com/privacy).

## 4. Permissions and their uses

- **Storage:** saves configuration and operational state, and provides the
  optional Chrome synchronization backup.
- **Notifications:** displays download-completion notices and operational
  errors.
- **Context menus:** lets you send a selected torrent or magnet link to
  Transmission and select configured destinations.
- **Scripting:** runs a helper bundled with the extension in a selected tab
  or frame to retrieve a torrent file after your request.
- **Alarms:** schedules periodic background status and completion checks,
  including enabled seeding-time rules.
- **Declarative network request access:** when authentication is enabled,
  applies Authorization headers to configured Transmission Web UI and RPC
  endpoints without putting credentials in the Web UI URL.
- **HTTP/HTTPS host access:** allows connections to user-configured servers,
  including local-network addresses, and retrieval of user-selected torrent
  resources from websites. These destinations are not known at installation.

Transmission script settings refer to scripts on your server. Path validation
does not inspect the server's filesystem or execute a script in Chrome.
Enabling a server-side hook instructs Transmission to use that server setting.

## 5. Security limitations

Use HTTPS when transmitting credentials or other sensitive information.
The extension also supports HTTP for compatibility with user-configured
servers. **HTTP traffic is not encrypted by the extension**, and choosing HTTP
can expose transmitted information to parties able to observe that connection.

Protect your browser profile, Google account, server credentials and backups.
The extension cannot guarantee the security or retention practices of your
server, a selected website, your operating system or browser services.

This policy describes actual behavior; it is not a claim that every possible
server configuration satisfies Chrome Web Store requirements.

## 6. Retention and your controls

- You can change or remove saved connection details and preferences in the
  extension's options.
- You can disable notifications and tracker-based seeding rules.
- Disabling or uninstalling the extension stops its background processing.
  Uninstalling normally removes its local extension storage, subject to
  Chrome's behavior.
- Use **Remove all settings in cloud** in the backup options to remove the extension's
  cloud backup. This does not erase your local connection settings.
  Uninstalling alone must not be relied on to delete a synchronized backup;
  clear that backup first and use Chrome's synchronization controls as needed.
- Session storage and in-memory state have lifetimes managed by Chrome.
- Changes or deletion in the extension do not erase torrents, files or logs
  already held by Transmission, website operators, Google or your operating
  system. Use those services' own controls where applicable.

The maintainer does not operate a central database of extension activity
from which your torrent records or stored credentials can be retrieved.

## 7. Limited use and external services

User data is used or transferred only as necessary to provide the extension's
stated torrent-management, configuration and backup features, rather than for
unrelated profiling or monetization. The extension's use and transfer of
information received from Google APIs will adhere to the
[Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data),
including its Limited Use requirements.

If you open the project, this policy or support pages on GitHub, GitHub handles
that visit under its own
[Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

## 8. Contact and policy changes

For privacy questions, contact the maintainer through the
[project issue tracker](https://github.com/ttamas007/transmission-easy-client-code975/issues).
**Issues are public. Do not post passwords, private torrent links, passkeys,
configuration backups or personal information.** Describe the question without
including sensitive data.

Updates to this policy will be published in this repository with a revised
effective date. Its
[revision history](https://github.com/ttamas007/transmission-easy-client-code975/commits/main/privacy.md)
is publicly available.

# LAPLACE Event Bridge - License Information

This monorepo contains multiple packages with different licenses:

## Package Licenses

### Server Packages

- `packages/server` - AGPL-3.0
- `packages/server-bun` - AGPL-3.0
- `examples/cli-demo` - AGPL-3.0

### SDK Package

- `packages/sdk` - MIT

## License Details

### AGPL-3.0 (GNU Affero General Public License v3.0)

The server packages are licensed under AGPL-3.0, which is a strong copyleft license. This means:

- You can use, modify, and distribute the software
- If you modify and distribute the software, you must release the source code
- If you run a modified version on a server and let users interact with it, you must provide the source code to those users
- Any software that links with AGPL code may need to be released under AGPL as well

For the full AGPL-3.0 license text, see the LICENSE file in the respective package directories.

### MIT License

The SDK package is licensed under the MIT License, which is a permissive license. This means:

- You can use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
- The software is provided "as is" without warranty
- You must include the copyright notice and license text in copies

For the full MIT license text, see `packages/sdk/LICENSE`.

## Why Different Licenses?

- **Server packages (AGPL-3.0)**: We use AGPL for server components to ensure that improvements to the server infrastructure benefit the community. If you run a modified version of our server, you must share those modifications.

- **SDK package (MIT)**: We use MIT for the client SDK to allow maximum flexibility for developers integrating with LAPLACE Event Bridge in their applications, including proprietary software.

## Questions?

If you have questions about licensing or need a different license for your use case, please contact us via Discord.

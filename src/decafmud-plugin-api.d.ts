/*  Play MUME!, a modern web client for MUME using DecafMUD.
    Copyright (C) 2017-2024, Waba and The MUME Team.

    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License along
    with this program; if not, write to the Free Software Foundation, Inc.,
    51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA. */

/**
 * Describes the interface for an external JavaScript plugin that can be registered
 * with a DecafMUD instance.
 */
export interface DecafMUDExternalPlugin {
    /**
     * Called when the DecafMUD socket successfully connects to the server.
     * Optional.
     */
    onConnect?: () => void;

    /**
     * Called when the DecafMUD socket disconnects from the server.
     * Optional.
     */
    onDisconnect?: () => void;

    /**
     * Called with decoded text received from the server.
     * This method is called before DecafMUD's internal `textInputFilter`.
     * If multiple external plugins are registered, they are called in registration order,
     * with each plugin receiving the text returned by the previous one.
     *
     * @param text The decoded text from the server (or from a preceding plugin).
     * @returns The processed text. If the text is not modified, it should return the original text.
     *          If a non-string is returned, a warning will be logged and original text used.
     * Optional.
     */
    onData?: (text: string) => string;

    /**
     * Injected by DecafMUD when the plugin is registered.
     * Use this function to send commands or data to the server as if typed by the user.
     * DecafMUD will typically append a newline sequence if not already present.
     *
     * @param dataToSend The command or data string to send.
     */
    send?: (dataToSend: string) => void;

    /**
     * Injected by DecafMUD when the plugin is registered.
     * Use this function to send GMCP messages to the server.
     * Requires the GMCP telopt to be active on the DecafMUD instance.
     *
     * @param packageName The GMCP package name (e.g., "Core.Hello").
     * @param message The GMCP message (can be an object which will be stringified or a string).
     */
    sendGMCP?: (packageName: string, message: any) => void;
}

// Extend the existing DecafMUDInstance interface if it's already declared elsewhere (e.g. in a global d.ts)
// This ensures we're adding to it, not replacing it.
declare global {
    interface DecafMUDInstance {
        /**
         * Registers an external JavaScript plugin with this DecafMUD instance.
         *
         * @param name The name of the plugin.
         * @param pluginObject The plugin object conforming to DecafMUDExternalPlugin.
         */
        registerExternalPlugin?: (name: string, pluginObject: DecafMUDExternalPlugin) => void;

        /**
         * Stores registered external plugins for this DecafMUD instance, keyed by plugin name.
         */
        externalPlugins?: { [key: string]: DecafMUDExternalPlugin };
    }
}

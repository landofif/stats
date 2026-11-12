pragma Singleton
import QtQuick

// Same colours as the phone site (style.css). Dark unless the system says light.
QtObject {
    readonly property bool dark: Qt.styleHints.colorScheme !== Qt.ColorScheme.Light
    readonly property color bg: dark ? "#111318" : "#f4f5f8"
    readonly property color card: dark ? "#1b1e25" : "#ffffff"
    readonly property color text: dark ? "#eceef2" : "#16181d"
    readonly property color muted: dark ? "#9399a6" : "#6b7180"
    readonly property color line: dark ? "#2a2e37" : "#e3e5ea"
    readonly property color accent: dark ? "#9d8cff" : "#6247e0"
    readonly property color accentSoft: dark ? "#272445" : "#e9e5fc"
}

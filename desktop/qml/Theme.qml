pragma Singleton
import QtQuick

// Same colours as the phone site (style.css): pink is the main accent, baby blue the
// second one. Dark unless the system says light.
QtObject {
    readonly property bool dark: Qt.styleHints.colorScheme !== Qt.ColorScheme.Light
    readonly property color bg: dark ? "#15121b" : "#fdf3f8"
    readonly property color surface: dark ? "#201c29" : "#ffffff"
    readonly property color surface2: dark ? "#2c2738" : "#f5e6f0"
    readonly property color text: dark ? "#f1e9f5" : "#2a1c2b"
    readonly property color muted: dark ? "#a89fb6" : "#7d6c80"
    readonly property color pink: dark ? "#ffadd2" : "#e4589a"
    readonly property color pinkSoft: dark ? "#4a2a40" : "#ffd9ea"
    readonly property color blue: dark ? "#a5d8ff" : "#2f8fd6"
    readonly property color blueSoft: dark ? "#1f3a52" : "#d6ecff"
    readonly property color onAccent: dark ? "#2a1322" : "#ffffff"
    // Short and soft: content moves a few pixels, never across the window.
    readonly property int motion: 200
}

import QtQuick
import QtQuick.Controls.Basic

AbstractButton {
    id: chip
    property bool selected: false
    property color tint: Theme.pink

    implicitHeight: 34
    implicitWidth: implicitContentWidth + leftPadding + rightPadding
    leftPadding: 14
    rightPadding: 14
    scale: down ? 0.96 : 1
    Behavior on scale { NumberAnimation { duration: 100 } }

    contentItem: Text {
        text: chip.text
        color: chip.selected ? Theme.onAccent : Theme.text
        font.pixelSize: 13
        font.weight: chip.selected ? Font.DemiBold : Font.Medium
        horizontalAlignment: Text.AlignHCenter
        verticalAlignment: Text.AlignVCenter
    }
    background: Rectangle {
        color: chip.selected ? chip.tint : chip.hovered ? Theme.surface2 : Theme.surface
        Behavior on color { ColorAnimation { duration: Theme.motion } }
    }
}

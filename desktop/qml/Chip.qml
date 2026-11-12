import QtQuick
import QtQuick.Controls.Basic

AbstractButton {
    id: chip
    property bool selected: false

    implicitHeight: 30
    implicitWidth: implicitContentWidth + leftPadding + rightPadding
    leftPadding: 12
    rightPadding: 12

    contentItem: Text {
        text: chip.text
        color: Theme.text
        font.pixelSize: 13
        font.weight: chip.selected ? Font.DemiBold : Font.Normal
        horizontalAlignment: Text.AlignHCenter
        verticalAlignment: Text.AlignVCenter
    }
    background: Rectangle {
        radius: height / 2
        color: chip.selected ? Theme.accentSoft : chip.hovered ? Theme.line : Theme.card
        border.color: chip.selected ? Theme.accent : Theme.line
    }
}

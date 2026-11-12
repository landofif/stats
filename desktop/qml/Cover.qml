import QtQuick
import QtQuick.Effects

// Album art with rounded corners; a plain tile while there is none.
Item {
    id: cover
    property string source
    property real radius: 12

    Rectangle { anchors.fill: parent; radius: cover.radius; color: Theme.surface2 }
    Image {
        id: image
        anchors.fill: parent
        source: cover.source
        sourceSize: Qt.size(160, 160)
        fillMode: Image.PreserveAspectCrop
        asynchronous: true
        visible: false
    }
    Rectangle { id: mask; anchors.fill: parent; radius: cover.radius; visible: false; layer.enabled: true }
    MultiEffect {
        anchors.fill: parent
        source: image
        maskEnabled: true
        maskSource: mask
        visible: image.status === Image.Ready
    }
}

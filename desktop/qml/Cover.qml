import QtQuick

// Album art; a plain tile while there is none.
Rectangle {
    property string source
    color: Theme.surface2
    Image {
        anchors.fill: parent
        source: parent.source
        sourceSize: Qt.size(160, 160)
        fillMode: Image.PreserveAspectCrop
        asynchronous: true
    }
}

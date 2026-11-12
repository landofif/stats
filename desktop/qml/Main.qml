import QtCore
import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts

ApplicationWindow {
    id: window
    width: 1000
    height: 720
    minimumWidth: 760
    minimumHeight: 500
    visible: true
    title: "Stats"
    color: Theme.bg

    // Icons are ligature names in the Material Symbols Rounded font.
    readonly property var views: [["Recent", "schedule"], ["Top", "trophy"], ["Trends", "bar_chart"]]
    property int current: 0
    property string syncText: ""

    Settings {
        property alias view: window.current
    }

    function refreshSync() {
        Api.load("/summary", function (s) {
            if (!s)
                return
            window.syncText = s.backfillDone ? Api.num(s.count) + " scrobbles"
                : s.playcount ? "Importing " + Api.num(s.count) + " of " + Api.num(s.playcount)
                : s.count ? "Importing… " + Api.num(s.count) : "Waiting for the first sync"
        }, true)
    }
    Component.onCompleted: refreshSync()
    Timer { interval: 60000; repeat: true; running: window.visible; onTriggered: window.refreshSync() }

    Shortcut { sequence: "1"; onActivated: window.current = 0 }
    Shortcut { sequence: "2"; onActivated: window.current = 1 }
    Shortcut { sequence: "3"; onActivated: window.current = 2 }
    Shortcut { sequences: ["F5", "Ctrl+R"]; onActivated: { stack.children[window.current].reload(); window.refreshSync() } }

    // A view fades in and rises a few pixels.
    onCurrentChanged: enter.restart()
    ParallelAnimation {
        id: enter
        NumberAnimation { target: stack; property: "opacity"; from: 0; to: 1; duration: Theme.motion; easing.type: Easing.OutQuint }
        NumberAnimation { target: rise; property: "y"; from: 8; to: 0; duration: Theme.motion; easing.type: Easing.OutQuint }
    }

    RowLayout {
        anchors.fill: parent
        anchors.margins: 12
        spacing: 20

        Rectangle {
            Layout.fillHeight: true
            Layout.preferredWidth: 190
            color: Theme.surface

            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 12
                spacing: 4

                Text {
                    text: "Stats<font color=\"" + Theme.pink + "\">.</font>"
                    textFormat: Text.StyledText
                    color: Theme.text
                    font.pixelSize: 28
                    font.weight: Font.ExtraBold
                    Layout.margins: 10
                    Layout.bottomMargin: 14
                }
                Repeater {
                    model: window.views
                    AbstractButton {
                        id: nav
                        required property var modelData
                        required property int index
                        readonly property bool selected: window.current === index
                        readonly property color ink: selected ? Theme.onAccent : Theme.muted
                        Layout.fillWidth: true
                        implicitHeight: 44
                        onClicked: window.current = index
                        contentItem: Row {
                            leftPadding: 14
                            spacing: 10
                            Text { anchors.verticalCenter: parent.verticalCenter; text: nav.modelData[1]; color: nav.ink; font.family: "Material Symbols Rounded"; font.pixelSize: 22 }
                            Text { anchors.verticalCenter: parent.verticalCenter; text: nav.modelData[0]; color: nav.ink; font.pixelSize: 14; font.weight: nav.selected ? Font.DemiBold : Font.Medium }
                        }
                        background: Rectangle {
                            color: nav.selected ? Theme.pink : nav.hovered ? Theme.surface2 : "transparent"
                            Behavior on color { ColorAnimation { duration: Theme.motion } }
                        }
                    }
                }
                Item { Layout.fillHeight: true }
                Rectangle {
                    visible: window.syncText !== ""
                    Layout.fillWidth: true
                    implicitHeight: syncLabel.implicitHeight + 16
                    color: Theme.blueSoft
                    Text {
                        id: syncLabel
                        anchors { left: parent.left; right: parent.right; margins: 12; verticalCenter: parent.verticalCenter }
                        text: window.syncText
                        color: Theme.blue
                        font.pixelSize: 12
                        font.weight: Font.Medium
                        wrapMode: Text.WordWrap
                    }
                }
            }
        }

        StackLayout {
            id: stack
            Layout.fillWidth: true
            Layout.fillHeight: true
            Layout.topMargin: 8
            Layout.rightMargin: 8
            currentIndex: window.current
            transform: Translate { id: rise }

            RecentView {}
            TopView {}
            TrendsView {}
        }
    }
}

import QtCore
import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts

ApplicationWindow {
    id: window
    width: 980
    height: 700
    minimumWidth: 720
    minimumHeight: 480
    visible: true
    title: "Stats"
    color: Theme.bg

    readonly property var views: ["Recent", "Top", "Trends"]
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

    RowLayout {
        anchors.fill: parent
        spacing: 0

        Rectangle {
            Layout.fillHeight: true
            Layout.preferredWidth: 180
            color: Theme.card

            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 12
                spacing: 4

                Text {
                    text: "Stats"
                    color: Theme.text
                    font.pixelSize: 20
                    font.bold: true
                    Layout.margins: 6
                    Layout.bottomMargin: 10
                }
                Repeater {
                    model: window.views
                    AbstractButton {
                        id: nav
                        required property string modelData
                        required property int index
                        readonly property bool selected: window.current === index
                        Layout.fillWidth: true
                        implicitHeight: 34
                        onClicked: window.current = index
                        contentItem: Text {
                            text: nav.modelData
                            leftPadding: 10
                            color: nav.selected ? Theme.accent : Theme.text
                            font.pixelSize: 14
                            font.weight: nav.selected ? Font.DemiBold : Font.Normal
                            verticalAlignment: Text.AlignVCenter
                        }
                        background: Rectangle {
                            radius: 8
                            color: nav.selected ? Theme.accentSoft : nav.hovered ? Theme.line : "transparent"
                        }
                    }
                }
                Item { Layout.fillHeight: true }
                Text {
                    text: window.syncText
                    color: Theme.muted
                    font.pixelSize: 12
                    wrapMode: Text.WordWrap
                    Layout.fillWidth: true
                    Layout.margins: 6
                }
            }
        }

        StackLayout {
            id: stack
            Layout.fillWidth: true
            Layout.fillHeight: true
            Layout.margins: 20
            currentIndex: window.current

            RecentView {}
            TopView {}
            TrendsView {}
        }
    }
}

import QtQuick
import QtQuick.Controls.Basic

// Now playing and the latest scrobbles, live from Last.fm through the Worker.
Item {
    id: view
    property var nowPlaying: null
    property string message: "Loading…"

    function reload() {
        Api.load("/recent?limit=100", function (data, error) {
            if (!data) {
                view.message = "Could not load: " + error
                return
            }
            view.nowPlaying = data.nowPlaying
            view.message = data.tracks.length || data.nowPlaying ? "" : "No scrobbles yet."
            const today = new Date().toDateString()
            const yesterday = new Date(Date.now() - 864e5).toDateString()
            tracks.clear()
            for (const t of data.tracks) {
                const date = new Date(t.ts * 1000)
                const day = date.toDateString()
                tracks.append({
                    track: t.track,
                    sub: t.album ? t.artist + " · " + t.album : t.artist,
                    image: t.image,
                    day: day === today ? "Today" : day === yesterday ? "Yesterday" : Qt.formatDate(date, "ddd d MMM"),
                    time: Qt.formatTime(date, "HH:mm")
                })
            }
        }, true)
    }
    onVisibleChanged: if (visible) reload()
    Component.onCompleted: reload()
    Timer { interval: 30000; repeat: true; running: view.visible; onTriggered: view.reload() }

    ListModel { id: tracks }

    Text {
        anchors.centerIn: parent
        visible: view.message !== "" && tracks.count === 0
        text: view.message
        color: Theme.muted
    }

    ListView {
        id: list
        anchors.fill: parent
        clip: true
        model: tracks
        spacing: 4
        boundsBehavior: Flickable.StopAtBounds
        ScrollBar.vertical: ScrollBar {}

        // Now playing: the one loud card.
        header: Item {
            width: list.width
            height: view.nowPlaying ? 108 : 0
            visible: view.nowPlaying !== null
            Rectangle {
                width: parent.width
                height: 100
                gradient: Gradient {
                    orientation: Gradient.Horizontal
                    GradientStop { position: 0; color: Theme.pink }
                    GradientStop { position: 1; color: Theme.blue }
                }
                Cover { id: cover; x: 14; y: 14; width: 72; height: 72; source: view.nowPlaying ? view.nowPlaying.image : "" }
                Column {
                    anchors { left: cover.right; right: parent.right; margins: 16; verticalCenter: parent.verticalCenter }
                    spacing: 1
                    Text { text: "Now playing"; color: Theme.onAccent; opacity: 0.8; font.pixelSize: 12; font.weight: Font.DemiBold }
                    Text { width: parent.width; elide: Text.ElideRight; textFormat: Text.PlainText; text: view.nowPlaying ? view.nowPlaying.track : ""; color: Theme.onAccent; font.pixelSize: 19; font.weight: Font.Bold }
                    Text { width: parent.width; elide: Text.ElideRight; textFormat: Text.PlainText; text: view.nowPlaying ? view.nowPlaying.artist : ""; color: Theme.onAccent; opacity: 0.8; font.pixelSize: 13 }
                }
            }
        }

        section.property: "day"
        section.delegate: Text {
            required property string section
            text: section
            color: Theme.blue
            font.pixelSize: 14
            font.weight: Font.DemiBold
            topPadding: 14
            bottomPadding: 8
            leftPadding: 8
        }

        delegate: Rectangle {
            required property string track
            required property string sub
            required property string image
            required property string time
            width: list.width
            height: 60
            color: Theme.surface
            Cover { id: art; x: 10; anchors.verticalCenter: parent.verticalCenter; width: 44; height: 44; source: parent.image }
            Column {
                anchors { left: art.right; right: clock.left; margins: 12; verticalCenter: parent.verticalCenter }
                Text { width: parent.width; elide: Text.ElideRight; textFormat: Text.PlainText; text: track; color: Theme.text; font.pixelSize: 14; font.weight: Font.DemiBold }
                Text { width: parent.width; elide: Text.ElideRight; textFormat: Text.PlainText; text: sub; color: Theme.muted; font.pixelSize: 13 }
            }
            Text { id: clock; anchors { right: parent.right; rightMargin: 16; verticalCenter: parent.verticalCenter } text: time; color: Theme.muted; font.pixelSize: 13 }
        }
    }
}

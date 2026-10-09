// Tracks which chat room (if any) the user is looking at right now, so a push
// notification for that same room doesn't pop up on top of the live chat.
let activeChatRoom: string | null = null;

export const setActiveChatRoom = (room: string | null) => {
  activeChatRoom = room;
};

export const getActiveChatRoom = () => activeChatRoom;

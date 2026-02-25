export class Room {
  id: string;
  name: string;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }
}

export const rooms: Array<Room> = [
  new Room("tante-aimee", "Tante Aimée"),
  new Room("jules-verne", "Jules Verne"),
  new Room("henriette", "Henriette"),
  new Room("yukiko", "Yukiko"),
]

const notFound: Room = new Room("not-found", "Not Found");

export function getRoom(roomId: string): Room {
  const room = rooms.find((room) => room.id === roomId);
  return room || notFound;
}

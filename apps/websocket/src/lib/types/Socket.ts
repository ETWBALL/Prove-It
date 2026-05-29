import { Socket } from "socket.io";


// ==== Socket Information ====

export interface User{
    publicId: string;
    sessionPublicId: string;
}
export interface AuthenticatedSocket extends Socket {
  data: {
    user: User; 
  };
}
export interface AuthorizedSocket extends Socket {
  data: {
    user: User;
    // We attach these here to guarantee this socket has cleared the security gate!
    authorizedDocumentId: string;
    authorizedAt: Date;
  };
}

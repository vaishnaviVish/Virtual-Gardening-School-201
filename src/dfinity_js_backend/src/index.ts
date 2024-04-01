import {
  query,
  update,
  text,
  Record,
  StableBTreeMap,
  Variant,
  Vec,
  None,
  Some,
  Ok,
  Err,
  ic,
  Principal,
  Opt,
  nat64,
  Duration,
  Result,
  bool,
  Canister,
  init,
} from "azle";
import {
  Ledger,
  binaryAddressFromAddress,
  binaryAddressFromPrincipal,
  hexAddressFromPrincipal,
} from "azle/canisters/ledger";
//@ts-ignore
import { hashCode } from "hashcode";
import { v4 as uuidv4 } from "uuid";

const Garden = Record({
  id: text,
  name: text,
  imageUrl: text,
  description: text,
  pricePerPerson: nat64,
  location: text,
  plants: Vec(text),
  isReserved: bool,
  isAvailable: bool,
  currentReservedTo: Opt(Principal),
  currentReservationEnds: Opt(nat64),
  creator: Principal,
});

const GardenPayload = Record({
  name: text,
  imageUrl: text,
  description: text,
  pricePerPerson: nat64,
  location: text,
  plants: Vec(text),
  
});

const InitPayload = Record({
  reservationFee: nat64,
});

const ReservationStatus = Variant({
  PaymentPending: text,
  Completed: text,
});

const Booking = Record({
  gardenId: text,
  amount: nat64,
  noOfPersons: nat64,
  status: ReservationStatus,
  payer: Principal,
  paid_at_block: Opt(nat64),
  memo: nat64,
});

const Message = Variant({
  Booked: text,
  NotBooked: text,
  NotFound: text,
  NotOwner: text,
  InvalidPayload: text,
  PaymentFailed: text,
  PaymentCompleted: text,
});

const gardenStorage = StableBTreeMap(0, text, Garden);
const persistedBookings = StableBTreeMap(1, Principal, Booking);
const pendingBookings = StableBTreeMap(2, nat64, Booking);

// fee to be charged upon garden reservation and refunded after garden is left
let reservationFee: Opt<nat64> = None;

const ORDER_RESERVATION_PERIOD = 120n; // reservation period in seconds

/* 
    initialization of the Ledger canister. The principal text value is hardcoded because 
    we set it in the `dfx.json`
*/
const icpCanister = Ledger(Principal.fromText("ryjl3-tyaaa-aaaaa-aaaba-cai"));

export default Canister({
  // set reservation fee
  initData: init([InitPayload], (payload) => {
    reservationFee = Some(payload.reservationFee);
  }),

  // return gardens reservation fee
  getGardens: query([], Vec(Garden), () => {
    return gardenStorage.values();
  }),

  // return orders
  getBookings: query([], Vec(Booking), () => {
    return persistedBookings.values();
  }),

  // return pending orders
  getPendings: query([], Vec(Booking), () => {
    return pendingBookings.values();
  }),

  // return a particular garden
  getGarden: query([text], Result(Garden, Message), (id) => {
    const gardenOpt = gardenStorage.get(id);
    if ("None" in gardenOpt) {
      return Err({ NotFound: `garden with id=${id} not found` });
    }
    return Ok(gardenOpt.Some);
  }),



// return gardens based on price
getGardenByPrice: query([nat64], Result(Vec(Garden), Message), (maxPrice) => {
  const filteredGardens = gardenStorage.values().filter((garden) => garden.pricePerPerson <= maxPrice);
  return Ok(filteredGardens);
}),

// return gardens based on location
getGardenByLocation: query([nat64], Result(Vec(Garden), Message), (location) => {
  const filteredGardens = gardenStorage.values().filter((garden) => garden.location === location);
  return Ok(filteredGardens);
}),

// return gardens based on name
getGardenByName: query([nat64], Result(Vec(Garden), Message), (name) => {
  const filteredGardens = gardenStorage.values().filter((garden) => garden.name === name);
  return Ok(filteredGardens);
}),


  // add new garden
  addGarden: update([GardenPayload], Result(Garden, Message), (payload) => {
    if (typeof payload !== "object" || Object.keys(payload).length === 0) {
      return Err({ NotFound: "invalid payoad" });
    }
    const garden = {
      id: uuidv4(),
      isReserved: false,
      isAvailable: true,
      currentReservedTo: None,
      currentReservationEnds: None,
      creator: ic.caller(),
      ...payload,
    };
    gardenStorage.insert(garden.id, garden);
    return Ok(garden);
  }),

  // delete garden
  deleteGarden: update([text], Result(text, Message), (id) => {
    // check garden before deleting
    const gardenOpt = gardenStorage.get(id);
    if ("None" in gardenOpt) {
      return Err({
        NotFound: `cannot delete the garden: garden with id=${id} not found`,
      });
    }

    if (gardenOpt.Some.creator.toString() !== ic.caller().toString()) {
      return Err({ NotOwner: "only creator can delete garden" });
    }

    if (gardenOpt.Some.isReserved) {
      return Err({
        Booked: `garden with id ${id} is currently booked`,
      });
    }
    const deletedGardenOpt = gardenStorage.remove(id);

    return Ok(deletedGardenOpt.Some.id);
  }),

  // create order for garden reservation
  createReservationOrder: update(
    [text, nat64],
    Result(Booking, Message),
    (id, noOfPersons) => {
      const gardenOpt = gardenStorage.get(id);
      if ("None" in gardenOpt) {
        return Err({
          NotFound: `cannot create the booking: garden=${id} not found`,
        });
      }

      if ("None" in reservationFee) {
        return Err({
          NotFound: "reservation fee not set",
        });
      }

      const garden = gardenOpt.Some;

      if (garden.isReserved) {
        return Err({
          Booked: `garden with id ${id} is currently booked`,
        });
      }

      // calculate total amount to be spent plus reservation fee
      let amountToBePaid =
        noOfPersons * garden.pricePerPerson + reservationFee.Some;

      // generate order
      const booking = {
        gardenId: garden.id,
        amount: amountToBePaid,
        noOfPersons,
        status: { PaymentPending: "PAYMENT_PENDING" },
        payer: ic.caller(),
        paid_at_block: None,
        memo: generateCorrelationId(id),
      };

      pendingBookings.insert(booking.memo, booking);

      discardByTimeout(booking.memo, ORDER_RESERVATION_PERIOD);

      return Ok(booking);
    }
  ),

  // complete garden reservation
  completeReservation: update(
    [text, nat64, nat64, nat64],
    Result(Booking, Message),
    async (id, noOfPersons, block, memo) => {
      // get garden
      const gardenOpt = gardenStorage.get(id);
      if ("None" in gardenOpt) {
        throw Error(`garden with id=${id} not found`);
      }

      const garden = gardenOpt.Some;

      // check reservation fee is set
      if ("None" in reservationFee) {
        return Err({
          NotFound: "reservation fee not set",
        });
      }

      // calculate total amount to be spent plus reservation fee
      let amount = noOfPersons * garden.pricePerPerson + reservationFee.Some;

      // check payments
      const paymentVerified = await verifyPaymentInternal(
        ic.caller(),
        amount,
        block,
        memo
      );

      if (!paymentVerified) {
        return Err({
          NotFound: `cannot complete the purchase: cannot verify the payment, memo=${memo}`,
        });
      }

      const pendingBookingOpt = pendingBookings.remove(memo);
      if ("None" in pendingBookingOpt) {
        return Err({
          NotFound: `cannot complete the purchase: there is no pending booking with id=${id}`,
        });
      }

      const booking = pendingBookingOpt.Some;
      const updatedBooking = {
        ...booking,
        status: { Completed: "COMPLETED" },
        paid_at_block: Some(block),
      };

      
      let durationInMins = BigInt(60 * 1000000000);

      // get updated record
      const updatedGarden = {
        ...garden,
        currentReservedTo: Some(ic.caller()),
        isReserved: true,
        currentReservationEnds: Some(ic.time() + durationInMins),
      };

      gardenStorage.insert(garden.id, updatedGarden);
      persistedBookings.insert(ic.caller(), updatedBooking);
      return Ok(updatedBooking);
    }
  ),

  // end reservation and receive your refund
  // complete garden reservation
  endReservation: update([text], Result(Message, Message), async (id) => {
    // get garden
    const gardenOpt = gardenStorage.get(id);
    if ("None" in gardenOpt) {
      return Err({ NotFound: `garden with id=${id} not found` });
    }

    const garden = gardenOpt.Some;

    if (!garden.isReserved) {
      return Err({ NotBooked: "garden is not reserved" });
    }

    if ("None" in garden.currentReservationEnds) {
      return Err({ NotBooked: "reservation time not set" });
    }

    if (garden.currentReservationEnds.Some > ic.time()) {
      return Err({ Booked: "booking time not yet over" });
    }

    if ("None" in garden.currentReservedTo) {
      return Err({ NotBooked: "garden not reserved to anyone" });
    }

    if (garden.currentReservedTo.Some.toString() !== ic.caller().toString()) {
      return Err({ Booked: "only booker of garden can unbook" });
    }

    // check reservation fee is set
    if ("None" in reservationFee) {
      return Err({
        NotFound: "reservation fee not set",
      });
    }

    const result = await makePayment(ic.caller(), reservationFee.Some);

    if ("Err" in result) {
      return result;
    }

    // get updated record
    const updatedGarden = {
      ...garden,
      currentReservedTo: None,
      isReserved: false,
      currentReservationEnds: None,
    };

    gardenStorage.insert(garden.id, updatedGarden);

    return result;
  }),

  // a helper function to get canister address from the principal
  getCanisterAddress: query([], text, () => {
    let canisterPrincipal = ic.id();
    return hexAddressFromPrincipal(canisterPrincipal, 0);
  }),

  // a helper function to get address from the principal
  getAddressFromPrincipal: query([Principal], text, (principal) => {
    return hexAddressFromPrincipal(principal, 0);
  }),

  // returns the reservation fee
  getReservationFee: query([], nat64, () => {
    if ("None" in reservationFee) {
      return BigInt(0);
    }
    return reservationFee.Some;
  }),
});

/*
    a hash function that is used to generate correlation ids for orders.
    also, we use that in the verifyPayment function where we check if the used has actually paid the order
*/
function hash(input: any): nat64 {
  return BigInt(Math.abs(hashCode().value(input)));
}

// a workaround to make uuid package work with Azle
globalThis.crypto = {
  // @ts-ignore
  getRandomValues: () => {
    let array = new Uint8Array(32);

    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }

    return array;
  },
};

// to process refund of reservation fee to users.
async function makePayment(address: Principal, amount: nat64) {
  const toAddress = hexAddressFromPrincipal(address, 0);
  const transferFeeResponse = await ic.call(icpCanister.transfer_fee, {
    args: [{}],
  });
  const transferResult = ic.call(icpCanister.transfer, {
    args: [
      {
        memo: 0n,
        amount: {
          e8s: amount - transferFeeResponse.transfer_fee.e8s,
        },
        fee: {
          e8s: transferFeeResponse.transfer_fee.e8s,
        },
        from_subaccount: None,
        to: binaryAddressFromAddress(toAddress),
        created_at_time: None,
      },
    ],
  });
  if ("Err" in transferResult) {
    return Err({ PaymentFailed: `refund failed, err=${transferResult.Err}` });
  }
  return Ok({ PaymentCompleted: "refund completed" });
}

function generateCorrelationId(productId: text): nat64 {
  const correlationId = `${productId}_${ic.caller().toText()}_${ic.time()}`;
  return hash(correlationId);
}

/*
    after the order is created, we give the `delay` amount of minutes to pay for the order.
    if it's not paid during this timeframe, the order is automatically removed from the pending orders.
*/
function discardByTimeout(memo: nat64, delay: Duration) {
  ic.setTimer(delay, () => {
    const order = pendingBookings.remove(memo);
    console.log(`Order discarded ${order}`);
  });
}

async function verifyPaymentInternal(
  sender: Principal,
  amount: nat64,
  block: nat64,
  memo: nat64
): Promise<bool> {
  const blockData = await ic.call(icpCanister.query_blocks, {
    args: [{ start: block, length: 1n }],
  });
  const tx = blockData.blocks.find((block) => {
    if ("None" in block.transaction.operation) {
      return false;
    }
    const operation = block.transaction.operation.Some;
    const senderAddress = binaryAddressFromPrincipal(sender, 0);
    const receiverAddress = binaryAddressFromPrincipal(ic.id(), 0);
    return (
      block.transaction.memo === memo &&
      hash(senderAddress) === hash(operation.Transfer?.from) &&
      hash(receiverAddress) === hash(operation.Transfer?.to) &&
      amount === operation.Transfer?.amount.e8s
    );
  });
  return tx ? true : false;
}

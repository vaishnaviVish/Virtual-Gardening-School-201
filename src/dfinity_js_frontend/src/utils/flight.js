import { transferICP } from "./ledger";

export async function getGardens() {
  try {
    return await window.canister.garden.getGardens();
  } catch (err) {
    if (err.name === "AgentHTTPResponseError") {
      const authClient = window.auth.client;
      await authClient.logout();
    }
    return [];
  }
}
export async function getBookings() {
  try {
    return await window.canister.garden.getBookings();
  } catch (err) {
    if (err.name === "AgentHTTPResponseError") {
      const authClient = window.auth.client;
      await authClient.logout();
    }
    return [];
  }
}

export async function getPendings() {
  try {
    return await window.canister.garden.getPendings();
  } catch (err) {
    if (err.name === "AgentHTTPResponseError") {
      const authClient = window.auth.client;
      await authClient.logout();
    }
    return [];
  }
}

export async function getReservationFee() {
  try {
    return await window.canister.garden.getReservationFee();
  } catch (err) {
    if (err.name === "AgentHTTPResponseError") {
      const authClient = window.auth.client;
      await authClient.logout();
    }
    return [];
  }
}

export async function addGarden(garden) {
  const result = await window.canister.garden.addGarden(garden);

  if (result.Err) {
    let error = Object.entries(result.Err);
    let errorMsg = `${error[0][0]} : ${error[0][1]}`;
    throw new Error(errorMsg);
  }

  return result.Ok;
}

// correct this function
export async function makeReservation(id, noOfPersons) {
  const gardenCanister = window.canister.garden;
  const orderResponse = await gardenCanister.createReservationOrder(
    id,
    noOfPersons
  );
  if (orderResponse.Err) {
    let error = Object.entries(orderResponse.Err);
    let errorMsg = `${error[0][0]} : ${error[0][1]}`;
    throw new Error(errorMsg);
  }
  const canisterAddress = await gardenCanister.getCanisterAddress();
  const block = await transferICP(
    canisterAddress,
    orderResponse.Ok.amount,
    orderResponse.Ok.memo
  );
  const result = await gardenCanister.completeReservation(
    id,
    noOfPersons,
    block,
    orderResponse.Ok.memo
  );
  if (result.Err) {
    let error = Object.entries(result.Err);
    let errorMsg = `${error[0][0]} : ${error[0][1]}`;
    throw new Error(errorMsg);
  }
  return result.Ok;
}

export async function endReservation(id) {
  const result = await window.canister.garden.endReservation(id);
  if (result.Err) {
    let error = Object.entries(result.Err);
    let errorMsg = `${error[0][0]} : ${error[0][1]}`;
    throw new Error(errorMsg);
  }

  return result.Ok;
}

export async function deleteGarden(id) {
  const result = await window.canister.garden.deleteGarden(id);
  if (result.Err) {
    let error = Object.entries(result.Err);
    let errorMsg = `${error[0][0]} : ${error[0][1]}`;
    throw new Error(errorMsg);
  }
  return result.Ok;
}
export async function getGarden(id) {
  const result = await window.canister.garden.getGarden(id);
  if (result.Err) {
    let error = Object.entries(result.Err);
    let errorMsg = `${error[0][0]} : ${error[0][1]}`;
    throw new Error(errorMsg);
  }
  return result.Ok;
}

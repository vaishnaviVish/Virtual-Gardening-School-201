import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import AddGarden from "./AddGarden";
import Garden from "./Garden";
import Loader from "../utils/Loader";
import { NotificationError, NotificationSuccess } from "../utils/Notifications";
import {
  getGardens as getGardenList,
  getReservationFee as getFee,
  addGarden as addGarden,
  makeReservation as makeReservationAction,
  endReservation as endReservationAction,
  deleteGarden as deletegardenAction,
} from "../../utils/garden";
import PropTypes from "prop-types";
import { Row } from "react-bootstrap";
import { formatE8s } from "../../utils/conversions";

const Gardens = ({ fetchBalance }) => {
  const [gardens, setGardens] = useState([]);
  const [reservationFee, setReservationFee] = useState(0);
  const [loading, setLoading] = useState(false);

  const getGardens = async () => {
    setLoading(true);
    getGardenList()
      .then((gardens) => {
        if (gardens) {
          setGardens(gardens);
        }
      })
      .catch((error) => {
        console.log(error);
      })
      .finally((_) => {
        setLoading(false);
      });
  };

  const getReservationFee = async () => {
    setLoading(true);
    getFee()
      .then((fee) => {
        if (fee) {
          setReservationFee(fee);
        }
      })
      .catch((error) => {
        console.log(error);
      })
      .finally((_) => {
        setLoading(false);
      });
  };

  useEffect(() => {
    getGardens();
    getReservationFee();
  }, []);

  const createNewGarden = async (data) => {
    setLoading(true);
    const priceStr = data.pricePerPerson;
    data.pricePerPerson = parseInt(priceStr, 10) * 10 ** 8;
    addGarden(data)
      .then(() => {
        toast(<NotificationSuccess text="Garden added successfully." />);
        getGardens();
        fetchBalance();
      })
      .catch((error) => {
        console.log(error);
        toast(<NotificationError text="Failed to create garden." />);
        setLoading(false);
      });
  };

  const makeReservation = async (garden, noOfPersons) => {
    setLoading(true);
    makeReservationAction(garden, noOfPersons)
      .then(() => {
        toast(<NotificationSuccess text="Reservation made successfully" />);
        getGardens();
        fetchBalance();
      })
      .catch((error) => {
        console.log(error);
        toast(<NotificationError text="Failed to make reservation." />);
        setLoading(false);
      });
  };

  const endReservation = async (id) => {
    setLoading(true);
    endReservationAction(id)
      .then(() => {
        toast(<NotificationSuccess text="Reservation ended successfully" />);
        getGardens();
        fetchBalance();
      })
      .catch((error) => {
        console.log(error);
        toast(<NotificationError text="Failed to end reservation." />);
        setLoading(false);
      });
  };

  const deleteGarden = async (id) => {
    setLoading(true);
    deletegardenAction(id)
      .then(() => {
        toast(<NotificationSuccess text="Garden deleted successfully" />);
        getGardens();
        fetchBalance();
      })
      .catch((error) => {
        console.log(error);
        toast(<NotificationError text="Failed to delete garden." />);
        setLoading(false);
      });
  };

  if (loading) {
    return <Loader />;
  }
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="fs-4 fw-bold mb-0 text-light">
          Virtual Gardening Application{" "}
        </h1>
        <AddGarden createNewGarden={createNewGarden} />
      </div>
      <div className="mb-3 text-light">
        <i className="bi bi-bell-fill"></i> Holding fee for any reservation is{" "}
        {formatE8s(reservationFee)} ICP.
      </div>
      <Row xs={1} sm={2} lg={3} className="g-3 mb-5 g-xl-4 g-xxl-5">
        <>
          {gardens.map((garden, index) => (
            <Garden
              garden={garden}
              makeReservation={makeReservation}
              endReservation={endReservation}
              deleteGarden={deleteGarden}
              key={index}
            />
          ))}
        </>
      </Row>
    </>
  );
};

Gardens.propTypes = {
  fetchBalance: PropTypes.func.isRequired,
};

export default Gardens;

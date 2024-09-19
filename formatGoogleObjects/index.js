const avatarRequest = async ({
  host = 'localhost:3000',
  protocol = 'http://',
  userName,
  accessToken,
  placesUrl,
}) => {
  try {
    const url = `${protocol}${host}/api/places-api/image`;

    const fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Access-Token': accessToken,
      },
      body: JSON.stringify({
        placesUrl,
        userName,
      }),
    };

    const fetchRes = await fetch(url, fetchOptions);
    const response = await fetchRes.json();

    return { result: response?.result };
  } catch (error) {
    return { error };
  }
};

const getAvatar = async ({ detailsPhotos, userName, accessToken }) => {
  for (const photo of detailsPhotos) {
    const { result: photoString, error: photoError } = await avatarRequest({
      placesUrl: photo.name,
      userName,
      accessToken,
    });

    if (photoError || !photoString) {
      continue;
    }
    return photoString;
  }

  return '';
};

const formBusinessObjects = ({ object, waivio_tags }) => {
  const objectData = {
    name: object.displayName.text,
    address: object.formattedAddress,
    ...(object.editorialSummary && {
      descriptions: [object.editorialSummary.text],
    }),
    ...(object.location && {
      latitude: object.location.latitude,
      longitude: object.location.longitude,
    }),
    ...(object.regularOpeningHours && {
      workingHours:
          object.regularOpeningHours.weekdayDescriptions.join(',\n'),
    }),
    ...(object.websiteUri && { websites: [object.websiteUri] }),
    ...(object.internationalPhoneNumber && {
      phone: object.internationalPhoneNumber,
    }),
    ...(object.rating && {
      features: [
        {
          key: 'Overall Rating',
          value: [object.rating],
        },
      ],
    }),
    companyIds: [{ companyIdType: 'googleMaps', companyId: object.id }],
    ...(object.reviews?.length && {
      reviews: object.reviews
        .map((el) => el?.text?.text)
        .filter((el) => !!el),
    }),
    waivio_tags,
  };

  return objectData;
};

const getNearObjects = async ({
  host = 'localhost:3000',
  protocol = 'http://',
  latitude,
  longitude,
  userName,
  accessToken,
  includedTypes,
}) => {
  try {
    const url = `${protocol}${host}/api/places-api/objects`;

    const fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Access-Token': accessToken,
      },
      body: JSON.stringify({
        latitude,
        longitude,
        userName,
        ...(includedTypes?.length && { includedTypes }),
      }),
    };

    const fetchRes = await fetch(url, fetchOptions);
    const response = await fetchRes.json();

    return { result: response?.result };
  } catch (error) {
    return { error };
  }
};

const main = async () => {
  // -----------------------------------EXAMPLE
  const userName = 'REPLACE';
  const accessToken = 'REPLACE';
  // New-York
  const latitude = 37.7937;
  const longitude = -122.3965;
  // -----------------------------------EXAMPLE

  const includedTypes = ['restaurant'];

  const { result, error } = await getNearObjects({
    userName,
    accessToken,
    latitude,
    longitude,
    includedTypes,
  });
  if (!result || error) throw new Error('Not Found');

  // here user pick objects and add waivio_tags EXAMPLE
  const waivio_tags = [{ key: 'Pros', value: 'beautysalon' }];
  const selectedObjects = result.slice(0, 1);
  // -----------------------------------EXAMPLE

  const processedItems = await Promise.all(selectedObjects.map(async (object) => {
    const processed = formBusinessObjects({
      object, waivio_tags,
    });
    const avatar = await getAvatar({
      detailsPhotos: object?.photos ?? [],
      userName,
      accessToken,
    });
    if (avatar) processed.primaryImageURLs = [];

    return processed;
  }));

  // Request to import
};

(async () => {
  await main();
  console.log();
})();

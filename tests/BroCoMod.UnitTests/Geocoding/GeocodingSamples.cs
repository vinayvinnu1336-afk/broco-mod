namespace BroCoMod.UnitTests.Geocoding;

/// <summary>Saved geocoder answers for pins in Hyderabad, so parsing is tested without the internet.</summary>
internal static class GeocodingSamples
{
    /// <summary>
    /// Real answer from nominatim.openstreetmap.org/reverse?format=jsonv2&amp;lat=17.4126&amp;lon=78.4482&amp;addressdetails=1&amp;accept-language=en
    /// (captured 2026-10-13). Note the GHMC ward prefix on the suburb and no road name.
    /// </summary>
    public const string NominatimBanjaraHills = """
    {"place_id":249407214,"licence":"Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright","osm_type":"way","osm_id":585620396,"lat":"17.4125740","lon":"78.4481905","category":"highway","type":"residential","place_rank":26,"importance":0.05340169604028378,"addresstype":"road","name":"","display_name":"Sri Ram Nagar Colony, Ward 93 Banjara Hills, Greater Hyderabad Municipal Corporation Central Zone, Hyderabad, Shaikpet mandal, Hyderabad, Telangana, 500034, India","address":{"neighbourhood":"Sri Ram Nagar Colony","suburb":"Ward 93 Banjara Hills","city_district":"Greater Hyderabad Municipal Corporation Central Zone","city":"Hyderabad","county":"Shaikpet mandal","state_district":"Hyderabad","state":"Telangana","ISO3166-2-lvl4":"IN-TS","postcode":"500034","country":"India","country_code":"in"},"boundingbox":["17.4125535","17.4128988","78.4481225","78.4482473"]}
    """;

    /// <summary>Nominatim answer for a mapped building with a house number and a spaced postcode.</summary>
    public const string NominatimWithHouseNumber = """
    {"place_id":1,"licence":"Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright","osm_type":"node","osm_id":2,"lat":"17.4138","lon":"78.4398","category":"building","type":"yes","display_name":"8-2-120/86, Road Number 2, Ward 93 Banjara Hills, Greater Hyderabad Municipal Corporation Central Zone, Hyderabad, Telangana, 500 034, India","address":{"house_number":"8-2-120/86","road":"Road Number 2","suburb":"Ward 93 Banjara Hills","city_district":"Greater Hyderabad Municipal Corporation Central Zone","city":"Hyderabad","state_district":"Hyderabad","state":"Telangana","postcode":"500 034","country":"India","country_code":"in"}}
    """;

    public const string NominatimError = """{"error":"Unable to geocode"}""";

    /// <summary>
    /// Google Geocoding API answer for the same Banjara Hills pin, in the documented response format
    /// (premise first, then a plus code and broader results).
    /// </summary>
    public const string GoogleBanjaraHills = """
    {
      "plus_code": { "compound_code": "CF6X+28 Hyderabad, Telangana, India", "global_code": "7J9WCF6X+28" },
      "results": [
        {
          "address_components": [
            { "long_name": "8-2-293/82/A/431", "short_name": "8-2-293/82/A/431", "types": ["premise"] },
            { "long_name": "Road Number 12", "short_name": "Rd Number 12", "types": ["route"] },
            { "long_name": "Sri Ram Nagar Colony", "short_name": "Sri Ram Nagar Colony", "types": ["political", "sublocality", "sublocality_level_2"] },
            { "long_name": "Banjara Hills", "short_name": "Banjara Hills", "types": ["political", "sublocality", "sublocality_level_1"] },
            { "long_name": "Hyderabad", "short_name": "Hyderabad", "types": ["locality", "political"] },
            { "long_name": "Hyderabad", "short_name": "Hyderabad", "types": ["administrative_area_level_2", "political"] },
            { "long_name": "Telangana", "short_name": "TG", "types": ["administrative_area_level_1", "political"] },
            { "long_name": "India", "short_name": "IN", "types": ["country", "political"] },
            { "long_name": "500034", "short_name": "500034", "types": ["postal_code"] }
          ],
          "formatted_address": "8-2-293/82/A/431, Road Number 12, Sri Ram Nagar Colony, Banjara Hills, Hyderabad, Telangana 500034, India",
          "geometry": { "location": { "lat": 17.4126081, "lng": 78.4482154 }, "location_type": "ROOFTOP" },
          "place_id": "ChIJ-sample-premise",
          "types": ["premise"]
        },
        {
          "address_components": [
            { "long_name": "CF6X+28", "short_name": "CF6X+28", "types": ["plus_code"] },
            { "long_name": "Hyderabad", "short_name": "Hyderabad", "types": ["locality", "political"] },
            { "long_name": "Telangana", "short_name": "TG", "types": ["administrative_area_level_1", "political"] },
            { "long_name": "India", "short_name": "IN", "types": ["country", "political"] }
          ],
          "formatted_address": "CF6X+28 Hyderabad, Telangana, India",
          "geometry": { "location": { "lat": 17.4126, "lng": 78.4482 }, "location_type": "GEOMETRIC_CENTER" },
          "place_id": "GhIJ-sample-plus-code",
          "types": ["plus_code"]
        },
        {
          "address_components": [
            { "long_name": "Banjara Hills", "short_name": "Banjara Hills", "types": ["political", "sublocality", "sublocality_level_1"] },
            { "long_name": "Hyderabad", "short_name": "Hyderabad", "types": ["locality", "political"] },
            { "long_name": "Telangana", "short_name": "TG", "types": ["administrative_area_level_1", "political"] },
            { "long_name": "India", "short_name": "IN", "types": ["country", "political"] }
          ],
          "formatted_address": "Banjara Hills, Hyderabad, Telangana, India",
          "geometry": { "location": { "lat": 17.4138, "lng": 78.4398 }, "location_type": "APPROXIMATE" },
          "place_id": "ChIJ-sample-sublocality",
          "types": ["political", "sublocality", "sublocality_level_1"]
        },
        {
          "address_components": [
            { "long_name": "500034", "short_name": "500034", "types": ["postal_code"] },
            { "long_name": "Hyderabad", "short_name": "Hyderabad", "types": ["locality", "political"] },
            { "long_name": "Telangana", "short_name": "TG", "types": ["administrative_area_level_1", "political"] },
            { "long_name": "India", "short_name": "IN", "types": ["country", "political"] }
          ],
          "formatted_address": "Hyderabad, Telangana 500034, India",
          "geometry": { "location": { "lat": 17.4156, "lng": 78.4347 }, "location_type": "APPROXIMATE" },
          "place_id": "ChIJ-sample-postal-code",
          "types": ["postal_code"]
        }
      ],
      "status": "OK"
    }
    """;

    /// <summary>Google answer on an unnamed lane where only a broader result carries the pincode.</summary>
    public const string GoogleUnnamedRoadPincodeElsewhere = """
    {
      "results": [
        {
          "address_components": [
            { "long_name": "Unnamed Road", "short_name": "Unnamed Road", "types": ["route"] },
            { "long_name": "Kondapur", "short_name": "Kondapur", "types": ["political", "sublocality", "sublocality_level_1"] },
            { "long_name": "Hyderabad", "short_name": "Hyderabad", "types": ["locality", "political"] },
            { "long_name": "Telangana", "short_name": "TG", "types": ["administrative_area_level_1", "political"] },
            { "long_name": "India", "short_name": "IN", "types": ["country", "political"] }
          ],
          "formatted_address": "Unnamed Road, Kondapur, Hyderabad, Telangana, India",
          "types": ["route"]
        },
        {
          "address_components": [
            { "long_name": "500084", "short_name": "500084", "types": ["postal_code"] },
            { "long_name": "Hyderabad", "short_name": "Hyderabad", "types": ["locality", "political"] },
            { "long_name": "Telangana", "short_name": "TG", "types": ["administrative_area_level_1", "political"] }
          ],
          "formatted_address": "Hyderabad, Telangana 500084, India",
          "types": ["postal_code"]
        }
      ],
      "status": "OK"
    }
    """;

    public const string GoogleRequestDenied = """
    { "error_message": "This API key is not authorized to use this service or API.", "results": [], "status": "REQUEST_DENIED" }
    """;

    public const string GoogleZeroResults = """{ "results": [], "status": "ZERO_RESULTS" }""";
}
